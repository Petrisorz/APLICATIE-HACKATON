import React, { useState, useEffect, useRef } from 'react';
import Quagga from '@ericblade/quagga2';
import Tesseract from 'tesseract.js';
import { Camera, Refrigerator, Activity, AlertTriangle, Trash2, Search, Zap, Image as ImageIcon, Plus, Minus, ChevronDown, ChevronUp, PieChart, HeartPulse, Bell, X, AlertCircle } from 'lucide-react';

interface Product {
  id: string;
  nume: string;
  brand: string;
  kcal: number;
  carbs: number;
  zaharuri: number;
  proteine: number;
  grasimi: number;
  sare: number;
  sursaText: string;
  alergeniDetectati: string[];
  imagine: string;
  cantitate: number;
  expirare: string;
  gramajTotal: number;
  procentRamas: number;
}

const ALERGENI_COMUNI = ['Lapte', 'Gluten', 'Ouă', 'Alune', 'Nuci', 'Soia', 'Pește', 'Fructe de mare', 'Țelină', 'Muștar'];

export default function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'fridge' | 'health' | 'diet'>('scan');
  const [fridge, setFridge] = useState<Product[]>([]);
  const [scanResult, setScanResult] = useState<Product | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveCode, setLiveCode] = useState("");
  const [ocrStatus, setOcrStatus] = useState("Apropie codul de bare...");

  const [tempCantitate, setTempCantitate] = useState(1);
  const [tempExpirare, setTempExpirare] = useState("");
  const [tempGramaj, setTempGramaj] = useState(100);
  
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [alergeniSelectati, setAlergeniSelectati] = useState<string[]>([]);
  
  const [dietKcalMax, setDietKcalMax] = useState(2500);
  const [dietKcalConsumed, setDietKcalConsumed] = useState(0);
  const [portiiDiet, setPortiiDiet] = useState<Record<string, number>>({});

  // --- STĂRI NOI: MONITOR GLICEMIE & ALERTE ---
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [glicemie, setGlicemie] = useState(90); // Valoare normala standard
  const [showExpiringModal, setShowExpiringModal] = useState(false);
  const [hideGlobalAlert, setHideGlobalAlert] = useState(false);

  const videoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScannedCode = useRef("");

  // ==========================================
  // --- 1. SCANARE LIVE (QUAGGA2) - NEATINS ---
  // ==========================================
  useEffect(() => {
    if (activeTab === 'scan' && !scanResult) {
      startScanner();
    } else {
      Quagga.stop();
    }
    return () => { Quagga.stop(); };
  }, [activeTab, scanResult]);

  const startScanner = () => {
    if (!videoRef.current) return;
    Quagga.init({
      inputStream: { type: "LiveStream", target: videoRef.current, constraints: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
      decoder: { readers: ["ean_reader", "ean_8_reader", "upc_reader", "code_128_reader"] },
      locate: true
    }, (err) => {
      if (err) { setOcrStatus("Eroare cameră!"); return; }
      Quagga.start(); setOcrStatus("Vânez liniile codului... 🔍");
    });
    Quagga.onDetected((data) => {
      const code = data.codeResult.code;
      if (code && code !== lastScannedCode.current) {
        lastScannedCode.current = code; setLiveCode(code); fetchProduct(code);
      }
    });
  };

  // --- 2. ÎNCĂRCARE FOTO / GALERIE (TESSERACT) - NEATINS ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true); setOcrStatus("Analizez poza... ⏳"); Quagga.stop();
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', { // @ts-ignore
        tessedit_char_whitelist: '0123456789' 
      });
      const cleaned = text.replace(/\D/g, '').trim();
      if (cleaned.length >= 8) { setLiveCode(cleaned); fetchProduct(cleaned); } 
      else { setOcrStatus("Nu am văzut cifre clare. Mai încearcă!"); setIsProcessing(false); startScanner(); }
    } catch (err) { setOcrStatus("Eroare la procesarea pozei."); setIsProcessing(false); startScanner(); }
  };

  // --- 3. API FETCH (NEATINS) ---
  async function fetchProduct(barcode: string) {
    if (isProcessing && activeTab !== 'scan') return; 
    setIsProcessing(true); setOcrStatus("📦 Căutare produs...");
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1) {
        const p = data.product;
        const sursa = [p.product_name, p.ingredients_text, p.brands].join(' ').toLowerCase();
        const isEgg = sursa.includes('oua') || sursa.includes('ouă') || sursa.includes('egg');
        const alergeniGasitiGlobal = ALERGENI_COMUNI.filter(a => sursa.includes(a.toLowerCase().replace('ă', 'a').replace('ș', 's').replace('ț', 't')));
        
        setTempCantitate(isEgg ? 30 : 1); setTempExpirare("");
        let parsedGramaj = 100;
        if (p.quantity) {
          const match = p.quantity.match(/(\d+)/);
          if (match) parsedGramaj = parseInt(match[1], 10);
        }
        setTempGramaj(parsedGramaj);
        setScanResult({
          id: barcode, nume: p.product_name || "Produs Necunoscut", brand: p.brands || "Brand Mixt",
          kcal: p.nutriments['energy-kcal_100g'] || 0, carbs: p.nutriments.carbohydrates_100g || 0,
          zaharuri: p.nutriments.sugars_100g || 0, proteine: p.nutriments.proteins_100g || 0,
          grasimi: p.nutriments.fat_100g || 0, sare: p.nutriments.salt_100g || 0,
          sursaText: sursa, alergeniDetectati: alergeniGasitiGlobal,
          imagine: p.image_front_small_url || "https://via.placeholder.com/150",
          cantitate: 1, expirare: "", gramajTotal: parsedGramaj, procentRamas: 100
        });
        setOcrStatus("✅ PRODUS GĂSIT!"); Quagga.stop();
      } else {
        setOcrStatus("❌ Cod negăsit: " + barcode); setIsProcessing(false); lastScannedCode.current = ""; if (activeTab === 'scan') startScanner();
      }
    } catch (e) { setOcrStatus("⚠️ Eroare rețea"); setIsProcessing(false); }
  }

  // --- FUNCTII FRIGIDER & DIET ---
  const adaugaInFrigider = () => {
    if (!scanResult) return;
    setFridge(prev => {
      const existingItem = prev.find(p => p.id === scanResult.id);
      if (existingItem) return prev.map(p => p.id === scanResult.id ? { ...p, cantitate: p.cantitate + tempCantitate, expirare: tempExpirare || p.expirare, gramajTotal: tempGramaj } : p);
      return [...prev, { ...scanResult, cantitate: tempCantitate, expirare: tempExpirare, gramajTotal: tempGramaj, procentRamas: 100 }];
    });
    setScanResult(null); setIsProcessing(false); setLiveCode(""); setActiveTab('fridge');
  };

  const toggleExpand = (id: string) => setExpandedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const modificaCantitate = (id: string, delta: number) => setFridge(prev => prev.map(p => p.id === id ? { ...p, cantitate: Math.max(0, p.cantitate + delta) } : p).filter(p => p.cantitate > 0));
  const actualizeazaProcentRamas = (id: string, procent: number) => setFridge(prev => prev.map(p => p.id === id ? { ...p, procentRamas: procent } : p));
  
  const consumaProdus = (item: Product) => {
    const grameConsumate = portiiDiet[item.id] || 100;
    const caloriiDeAdaugat = (item.kcal / 100) * grameConsumate;
    setDietKcalConsumed(prev => Math.round(prev + caloriiDeAdaugat));
    const procentConsumat = (grameConsumate / item.gramajTotal) * 100;

    setFridge(prev => prev.map(p => {
      if (p.id === item.id) {
        let nouProcent = p.procentRamas - procentConsumat;
        let nouaCantitate = p.cantitate;
        if (nouProcent <= 0) {
           nouaCantitate -= 1;
           nouProcent = nouaCantitate > 0 ? 100 : 0; 
        }
        return { ...p, procentRamas: Math.max(0, Math.round(nouProcent)), cantitate: Math.max(0, nouaCantitate) };
      }
      return p;
    }).filter(p => p.cantitate > 0));
  };

  const checkAlergeniPericol = (sursaText: string) => alergeniSelectati.filter(a => sursaText.includes(a.toLowerCase().replace('ă', 'a').replace('ș', 's').replace('ț', 't')));

  // --- LOGICA ALERTE EXPIRARE ---
  const getExpiringItems = () => {
    const now = new Date().getTime();
    const _48h = 48 * 60 * 60 * 1000;
    return fridge.filter(item => {
      if (!item.expirare) return false;
      const expTime = new Date(item.expirare).getTime();
      return (expTime - now) <= _48h; // Expira in 48h sau a expirat deja
    });
  };
  const expiringItems = getExpiringItems();

  // --- LOGICA RECOMANDARE HIPOGLICEMIE ---
  const genereazaRecomandareHipo = () => {
    if (fridge.length === 0) return "Nu ai alimente în frigider! Consumă urgent zahăr, miere sau un suc dulce.";
    
    // Cautam produse cu carbohidrati / zaharuri, le sortam descrescator
    const produseZaharoase = [...fridge].filter(p => p.carbs > 0).sort((a, b) => b.carbs - a.carbs);
    if (produseZaharoase.length === 0) return "Frigiderul tău nu are surse rapide de carbohidrați (zahăr/pâine). Consumă miere sau zahăr simplu!";

    const produs = produseZaharoase[0];
    // Regula standard: 15g carbohidrati rapizi
    // Daca 100g produs are X carbs => necesar = (15 * 100) / carbs
    const grameNecesare = Math.round((15 * 100) / produs.carbs);
    return `Recomandare rapidă: Mănâncă ~${grameNecesare}g de ${produs.nume} pentru a obține 15g de carbohidrați necesari recuperării.`;
  };

  return (
    <div style={{ maxWidth: '450px', margin: '0 auto', minHeight: '100vh', background: '#f0f2f5', fontFamily: 'sans-serif', paddingBottom: '90px', position: 'relative' }}>
      
      {/* HEADER */}
      <header style={{ background: '#1b5e20', color: 'white', padding: '20px', textAlign: 'center', borderRadius: '0 0 20px 20px', position: 'relative' }}>
        <h2 style={{ margin: 0 }}>KitchenGuard AI 🥗</h2>
        {/* BUTON MONITOR GLICEMIE */}
        <button 
          onClick={() => setIsMonitorOpen(true)}
          style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'white', color: '#d32f2f', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
        >
          <HeartPulse size={24} />
        </button>
      </header>

      {/* BANNER GLOBAL ALERTA EXPIRARE */}
      {expiringItems.length > 0 && !hideGlobalAlert && (
        <div style={{ background: '#ff9800', color: 'white', padding: '10px 15px', margin: '10px 20px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            <Bell size={18} /> Atenție! Ai {expiringItems.length} produs(e) care expiră curând!
          </div>
          <button onClick={() => setHideGlobalAlert(true)} style={{ background: 'none', border: 'none', color: 'white' }}><X size={18} /></button>
        </div>
      )}

      {/* OVERLAY MONITOR GLICEMIE */}
      {isMonitorOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '25px', padding: '25px', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setIsMonitorOpen(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888' }}><X size={24} /></button>
            
            <h3 style={{ marginTop: 0, color: '#333' }}>Monitor Glicemie</h3>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '-10px' }}>Senzor virtual de monitorizare</p>
            
            {/* ECRAN DETECTOR */}
            <div style={{ background: glicemie > 140 ? '#ffebee' : glicemie < 70 ? '#e3f2fd' : '#e8f5e9', border: `3px solid ${glicemie > 140 ? '#d32f2f' : glicemie < 70 ? '#1976d2' : '#1b5e20'}`, borderRadius: '20px', padding: '30px', margin: '20px 0', transition: 'all 0.3s' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: glicemie > 140 ? '#c62828' : glicemie < 70 ? '#1565c0' : '#1b5e20' }}>
                {glicemie}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#555', marginTop: '5px' }}>
                {glicemie > 140 ? '⚠️ Hiperglicemie' : glicemie < 70 ? '⚠️ Hipoglicemie' : '✅ Nivel Normal'}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>mg/dL</div>
            </div>

            {/* ACTIUNI & RECOMANDARI ALERTA */}
            {glicemie < 70 && (
              <div style={{ background: '#bbdefb', padding: '15px', borderRadius: '15px', textAlign: 'left', marginBottom: '20px', border: '1px solid #1976d2' }}>
                <strong style={{ color: '#0d47a1', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertCircle size={18}/> Alerta Scădere:</strong>
                <p style={{ fontSize: '13px', margin: '5px 0 0 0', color: '#0d47a1' }}>{genereazaRecomandareHipo()}</p>
              </div>
            )}

            {glicemie > 140 && (
              <div style={{ background: '#ffcdd2', padding: '15px', borderRadius: '15px', textAlign: 'left', marginBottom: '20px', border: '1px solid #d32f2f' }}>
                <strong style={{ color: '#b71c1c', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertCircle size={18}/> Alerta Creștere:</strong>
                <p style={{ fontSize: '13px', margin: '5px 0 0 0', color: '#b71c1c' }}>Ai depășit limita. Evită complet produsele bogate în zaharuri din frigider și hidratează-te!</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setGlicemie(prev => prev + 60)} style={{ flex: 1, background: '#ef5350', color: 'white', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 'bold' }}>⬆️ RAISE</button>
              <button onClick={() => setGlicemie(90)} style={{ background: '#eee', border: 'none', padding: '15px', borderRadius: '15px' }}>Reset</button>
              <button onClick={() => setGlicemie(prev => prev - 40)} style={{ flex: 1, background: '#42a5f5', color: 'white', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 'bold' }}>⬇️ REDUCE</button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY MODAL PRODUSE EXPIRATE */}
      {showExpiringModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '20px', padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
               <h3 style={{ margin: 0, color: '#d32f2f', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={20}/> Expiră Curând!</h3>
               <button onClick={() => setShowExpiringModal(false)} style={{ background: 'none', border: 'none' }}><X size={24}/></button>
             </div>
             {expiringItems.length === 0 ? <p>Nu ai alerte.</p> : expiringItems.map(item => (
               <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', background: '#fff3e0', padding: '10px', borderRadius: '10px' }}>
                 <img src={item.imagine} width="40" height="40" style={{ borderRadius: '8px', objectFit: 'cover' }} />
                 <div>
                   <strong style={{ fontSize: '14px' }}>{item.nume}</strong><br/>
                   <small style={{ color: '#d32f2f', fontWeight: 'bold' }}>Data: {new Date(item.expirare).toLocaleDateString('ro-RO')}</small>
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}

      <main style={{ padding: '20px' }}>
        
        {/* ======================= TAB: SCAN ======================= */}
        {activeTab === 'scan' && !scanResult && (
          <div style={{ textAlign: 'center' }}>
            <div ref={videoRef} style={{ position: 'relative', borderRadius: '30px', overflow: 'hidden', border: '5px solid #1b5e20', height: '320px', background: '#000' }}>
              <div className="laser-line"></div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <label style={{ flex: 1, background: '#fff', color: '#1b5e20', border: '2px solid #1b5e20', padding: '12px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <Camera size={18} /> FĂ POZĂ
                <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              <label style={{ flex: 1, background: '#fff', color: '#1b5e20', border: '2px solid #1b5e20', padding: '12px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <ImageIcon size={18} /> GALERIE
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ marginTop: '15px', background: 'white', padding: '15px', borderRadius: '20px', boxShadow: '0 5px 15px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#1b5e20' }}>
                <Zap size={20} className={isProcessing ? "animate-pulse" : ""} />
                <span style={{ fontWeight: 'bold' }}>{ocrStatus}</span>
              </div>
              <h1 style={{ letterSpacing: '4px', color: '#333', margin: '10px 0' }}>{liveCode || "••••••••"}</h1>
            </div>
          </div>
        )}

        {/* --- REZULTAT SCANARE --- */}
        {scanResult && (
          <div style={{ background: 'white', padding: '20px', borderRadius: '25px', border: '2px solid #1b5e20' }}>
            <img src={scanResult.imagine} style={{ width: '80px', display: 'block', margin: '0 auto 10px', borderRadius: '15px' }} />
            <h3 style={{ margin: '0', textAlign: 'center' }}>{scanResult.nume}</h3>
            <p style={{ color: '#666', textAlign: 'center', marginBottom: '15px', fontSize: '12px' }}>{scanResult.brand}</p>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 1, background: '#e8f5e9', padding: '8px', borderRadius: '10px', textAlign: 'center' }}>
                <small>Energie/100g</small><br/><strong>{scanResult.kcal} kcal</strong>
              </div>
              <div style={{ flex: 1, background: '#e8f5e9', padding: '8px', borderRadius: '10px', textAlign: 'center' }}>
                <small>Zaharuri/100g</small><br/><strong>{scanResult.zaharuri} g</strong>
              </div>
            </div>

            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '15px', marginBottom: '15px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '5px' }}>PACHETE/BUCĂȚI:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <button onClick={() => setTempCantitate(Math.max(1, tempCantitate - 1))} style={{ background: '#ddd', border: 'none', padding: '10px', borderRadius: '10px' }}><Minus size={18} /></button>
                <input type="number" value={tempCantitate} onChange={(e) => setTempCantitate(Number(e.target.value))} style={{ flex: 1, textAlign: 'center', fontSize: '18px', fontWeight: 'bold', border: '1px solid #ccc', borderRadius: '10px', padding: '8px' }} />
                <button onClick={() => setTempCantitate(tempCantitate + 1)} style={{ background: '#1b5e20', color: 'white', border: 'none', padding: '10px', borderRadius: '10px' }}><Plus size={18} /></button>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '11px', marginBottom: '5px' }}>GRAMAJ PER PACHET (g):</label>
                  <input type="number" value={tempGramaj} onChange={(e) => setTempGramaj(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '11px', marginBottom: '5px' }}>DATA EXPIRĂRII:</label>
                  <input type="date" value={tempExpirare} onChange={(e) => setTempExpirare(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            <button onClick={adaugaInFrigider} style={{ width: '100%', background: '#1b5e20', color: 'white', border: 'none', padding: '16px', borderRadius: '15px', fontWeight: 'bold' }}>
              ADAUGĂ ÎN FRIGIDER
            </button>
            <button onClick={() => { setScanResult(null); setIsProcessing(false); setLiveCode(""); lastScannedCode.current = ""; startScanner(); }} style={{ width: '100%', border: 'none', background: 'none', color: '#888', marginTop: '10px' }}>
              Anulează
            </button>
          </div>
        )}

        {/* ======================= TAB: FRIGIDER ======================= */}
        {activeTab === 'fridge' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, paddingLeft: '5px' }}>❄️ Frigiderul tău</h3>
              {expiringItems.length > 0 && (
                <button onClick={() => setShowExpiringModal(true)} style={{ background: '#ff9800', color: 'white', border: 'none', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                  <AlertCircle size={18} /> {expiringItems.length} Alerte
                </button>
              )}
            </div>
            
            {fridge.length === 0 && <p style={{textAlign: 'center', color: '#999', marginTop: '20px'}}>Frigiderul e gol.</p>}
            
            {fridge.map((item) => {
              const pericolCurent = checkAlergeniPericol(item.sursaText);
              const hasAlergiePericol = pericolCurent.length > 0;
              const isExpanded = expandedItems.includes(item.id);

              return (
                <div key={item.id} style={{ background: hasAlergiePericol ? '#fff5f5' : 'white', padding: '15px', borderRadius: '15px', marginBottom: '10px', border: hasAlergiePericol ? '3px solid #d32f2f' : '1px solid #eee', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: 'all 0.3s' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <img src={item.imagine} width="45" height="45" style={{ borderRadius: '8px', marginRight: '15px', objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <strong>{item.nume}</strong><br/>
                      <small style={{color: '#888'}}>{item.brand}</small>
                      {item.expirare && <div style={{ fontSize: '11px', color: '#f57c00', marginTop: '3px' }}>⏳ Exp: {new Date(item.expirare).toLocaleDateString('ro-RO')}</div>}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f0f2f5', borderRadius: '10px', padding: '5px' }}>
                      <button onClick={() => modificaCantitate(item.id, 1)} style={{ border: 'none', background: 'none', color: '#1b5e20' }}><Plus size={16} /></button>
                      <span style={{ fontWeight: 'bold', margin: '5px 0' }}>x{item.cantitate}</span>
                      <button onClick={() => modificaCantitate(item.id, -1)} style={{ border: 'none', background: 'none', color: '#d32f2f' }}><Minus size={16} /></button>
                    </div>
                  </div>

                  {item.alergeniDetectati.length > 0 && (
                    <div style={{ display: 'inline-block', border: '1px solid #ef5350', color: '#c62828', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', marginTop: '8px', fontWeight: 'bold' }}>
                      Conține: {item.alergeniDetectati.join(', ')}
                    </div>
                  )}

                  {hasAlergiePericol && (
                    <div style={{ background: '#d32f2f', color: 'white', padding: '8px', borderRadius: '8px', marginTop: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AlertTriangle size={14} /> <strong>PERICOL SĂNĂTATE: {pericolCurent.join(', ')}</strong>
                    </div>
                  )}

                  <button onClick={() => toggleExpand(item.id)} style={{ width: '100%', background: 'none', border: 'none', color: '#aaa', marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #eee', paddingTop: '10px', marginTop: '5px' }}>
                      <div style={{ marginBottom: '15px', background: '#f9f9f9', padding: '10px', borderRadius: '10px' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '5px', fontWeight: 'bold' }}>
                           <span>MAI AI: {item.procentRamas}%</span>
                           <span>Din pachet ({item.gramajTotal}g)</span>
                         </div>
                         <input 
                           type="range" 
                           min="0" max="100" 
                           value={item.procentRamas}
                           onChange={(e) => actualizeazaProcentRamas(item.id, Number(e.target.value))}
                           style={{ width: '100%', accentColor: '#1b5e20' }}
                         />
                      </div>

                      <div style={{ fontSize: '12px', color: '#555' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>🔥 Calorii / 100g:</span> <strong>{item.kcal} kcal</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>🍞 Carbohidrați:</span> <strong>{item.carbs} g</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>🥩 Proteine:</span> <strong>{item.proteine} g</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>🧈 Grăsimi:</span> <strong>{item.grasimi} g</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>🧂 Sare:</span> <strong>{item.sare} g</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ======================= TAB: HEALTH (ALERGENI) ======================= */}
        {activeTab === 'health' && (
          <div>
            <h3>🩺 Setări Alergeni</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>Selectează alergenii de evitat. Produsele din frigider care îi conțin vor fi marcate cu roșu.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {ALERGENI_COMUNI.map(alergen => {
                const isSelected = alergeniSelectati.includes(alergen);
                return (
                  <button 
                    key={alergen}
                    onClick={() => setAlergeniSelectati(prev => isSelected ? prev.filter(a => a !== alergen) : [...prev, alergen])}
                    style={{
                      padding: '12px', borderRadius: '12px', border: isSelected ? '2px solid #d32f2f' : '1px solid #ddd',
                      background: isSelected ? '#ffebee' : 'white', color: isSelected ? '#d32f2f' : '#333',
                      fontWeight: isSelected ? 'bold' : 'normal', transition: 'all 0.2s'
                    }}
                  >
                    {alergen}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ======================= TAB: DIET ======================= */}
        {activeTab === 'diet' && (
          <div>
            <div style={{ textAlign: 'center', background: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
              <h3>🎯 Target Zilnic</h3>
              <div style={{ position: 'relative', width: '160px', height: '160px', margin: '20px auto' }}>
                <svg width="160" height="160">
                  <circle cx="80" cy="80" r="70" stroke="#eee" strokeWidth="12" fill="none" />
                  <circle cx="80" cy="80" r="70" stroke={dietKcalConsumed > dietKcalMax ? "#d32f2f" : "#1b5e20"} strokeWidth="12" fill="none"
                    strokeDasharray={440} 
                    strokeDashoffset={440 - (Math.min(dietKcalConsumed / dietKcalMax, 1) * 440)} 
                    strokeLinecap="round" transform="rotate(-90 80 80)" style={{ transition: 'stroke-dashoffset 0.5s ease' }} 
                  />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: dietKcalConsumed > dietKcalMax ? '#d32f2f' : '#333' }}>{dietKcalConsumed}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>kcal</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
                out of <input type="number" value={dietKcalMax} onChange={(e) => setDietKcalMax(Number(e.target.value))} style={{ width: '60px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '5px', padding: '3px' }} /> kcal
              </div>
              <p style={{ color: dietKcalConsumed > dietKcalMax ? '#d32f2f' : '#1b5e20', fontWeight: 'bold', marginTop: '10px' }}>
                {dietKcalMax - dietKcalConsumed > 0 ? `${dietKcalMax - dietKcalConsumed} kcal left` : `Ai depășit cu ${dietKcalConsumed - dietKcalMax} kcal!`}
              </p>
              <button onClick={() => setDietKcalConsumed(0)} style={{ marginTop: '10px', fontSize: '11px', background: 'none', border: 'none', color: '#888' }}>🔄 Resetează calorii</button>
            </div>

            <h4 style={{ paddingLeft: '5px' }}>🍽️ Mănâncă din Frigider</h4>
            {fridge.length === 0 && <p style={{ fontSize: '13px', color: '#888', textAlign: 'center' }}>Niciun produs disponibil.</p>}
            {fridge.map(item => (
              <div key={item.id} style={{ background: 'white', padding: '15px', borderRadius: '15px', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '14px' }}>{item.nume}</strong> <span style={{ fontSize: '11px', color: '#888' }}>(x{item.cantitate})</span><br/>
                    <small style={{ color: '#1b5e20', fontWeight: 'bold' }}>{item.kcal} kcal / 100g</small>
                  </div>
                  <div style={{ fontSize: '11px', color: '#ef5350', fontWeight: 'bold', textAlign: 'right' }}>
                    Stoc: {item.procentRamas}%
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <label style={{ position: 'absolute', top: '-8px', left: '10px', background: 'white', padding: '0 5px', fontSize: '10px', color: '#666' }}>Porție (g)</label>
                    <input 
                      type="number" 
                      value={portiiDiet[item.id] || 100} 
                      onChange={(e) => setPortiiDiet({...portiiDiet, [item.id]: Number(e.target.value)})}
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button onClick={() => consumaProdus(item)} style={{ background: '#e8f5e9', color: '#1b5e20', border: '1px solid #1b5e20', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold' }}>
                    CONSUMĂ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ======================= BOTTOM NAV ======================= */}
      <nav style={{ position: 'fixed', bottom: 0, width: '100%', maxWidth: '450px', height: '75px', background: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #ddd', zIndex: 100 }}>
        <button onClick={() => setActiveTab('scan')} style={{ border: 'none', background: 'none', color: activeTab === 'scan' ? '#1b5e20' : '#ccc' }}>
          <Camera /><br/><span style={{fontSize: '10px', fontWeight: 'bold'}}>SCAN</span>
        </button>
        <button onClick={() => setActiveTab('fridge')} style={{ border: 'none', background: 'none', color: activeTab === 'fridge' ? '#1b5e20' : '#ccc' }}>
          <Refrigerator /><br/><span style={{fontSize: '10px', fontWeight: 'bold'}}>FRIGIDER</span>
        </button>
        <button onClick={() => setActiveTab('health')} style={{ border: 'none', background: 'none', color: activeTab === 'health' ? '#1b5e20' : '#ccc' }}>
          <Activity /><br/><span style={{fontSize: '10px', fontWeight: 'bold'}}>HEALTH</span>
        </button>
        <button onClick={() => setActiveTab('diet')} style={{ border: 'none', background: 'none', color: activeTab === 'diet' ? '#1b5e20' : '#ccc' }}>
          <PieChart /><br/><span style={{fontSize: '10px', fontWeight: 'bold'}}>DIET</span>
        </button>
      </nav>

      <style>{`
        .laser-line { position: absolute; top: 50%; left: 5%; right: 5%; height: 2px; background: red; box-shadow: 0 0 10px red; z-index: 10; animation: scanAnim 2.5s infinite ease-in-out; }
        @keyframes scanAnim { 0%, 100% { top: 30%; } 50% { top: 70%; } }
        video { width: 100%; height: 100%; object-fit: cover; }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; transition: 0.2s; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
      `}</style>
    </div>
  );
}