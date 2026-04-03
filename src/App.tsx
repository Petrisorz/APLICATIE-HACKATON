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

  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [glicemie, setGlicemie] = useState(90);
  const [showExpiringModal, setShowExpiringModal] = useState(false);
  const [hideGlobalAlert, setHideGlobalAlert] = useState(false);

  const videoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScannedCode = useRef("");

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

  const getExpiringItems = () => {
    const now = new Date().getTime();
    const _48h = 48 * 60 * 60 * 1000;
    return fridge.filter(item => {
      if (!item.expirare) return false;
      const expTime = new Date(item.expirare).getTime();
      return (expTime - now) <= _48h; 
    });
  };
  const expiringItems = getExpiringItems();

  const genereazaRecomandareHipo = () => {
    if (fridge.length === 0) return "Nu ai alimente în frigider! Consumă urgent zahăr, miere sau un suc dulce.";
    const produseZaharoase = [...fridge].filter(p => p.carbs > 0).sort((a, b) => b.carbs - a.carbs);
    if (produseZaharoase.length === 0) return "Frigiderul tău nu are surse rapide de carbohidrați (zahăr/pâine). Consumă miere sau zahăr simplu!";
    const produs = produseZaharoase[0];
    const grameNecesare = Math.round((15 * 100) / produs.carbs);
    return `Recomandare rapidă: Mănâncă ~${grameNecesare}g de ${produs.nume} pentru a obține 15g de carbohidrați necesari recuperării.`;
  };

  return (
    <div className="app-container">
      
      {/* HEADER */}
      <header style={{ background: '#1b5e20', color: 'white', padding: '20px', textAlign: 'center', borderRadius: '0 0 20px 20px', position: 'relative', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: 0, fontSize: 'clamp(1.2rem, 3vw, 1.5rem)' }}>KitchenGuard AI 🥗</h2>
        <button 
          onClick={() => setIsMonitorOpen(true)}
          style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'white', color: '#d32f2f', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', cursor: 'pointer' }}
        >
          <HeartPulse size={24} />
        </button>
      </header>

      {/* BANNER GLOBAL ALERTA EXPIRARE */}
      {expiringItems.length > 0 && !hideGlobalAlert && (
        <div style={{ background: '#ff9800', color: 'white', padding: '12px 20px', margin: '15px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 'bold' }}>
            <Bell size={20} /> Atenție! Ai {expiringItems.length} produs(e) care expiră curând!
          </div>
          <button onClick={() => setHideGlobalAlert(true)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
        </div>
      )}

      {/* OVERLAY MONITOR GLICEMIE */}
      {isMonitorOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button onClick={() => setIsMonitorOpen(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={24} /></button>
            <h3 style={{ marginTop: 0, color: '#333' }}>Monitor Glicemie</h3>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '-10px' }}>Senzor virtual de monitorizare</p>
            
            <div style={{ background: glicemie > 140 ? '#ffebee' : glicemie < 70 ? '#e3f2fd' : '#e8f5e9', border: `3px solid ${glicemie > 140 ? '#d32f2f' : glicemie < 70 ? '#1976d2' : '#1b5e20'}`, borderRadius: '20px', padding: '30px', margin: '20px 0', transition: 'all 0.3s' }}>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: glicemie > 140 ? '#c62828' : glicemie < 70 ? '#1565c0' : '#1b5e20' }}>
                {glicemie}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#555', marginTop: '5px' }}>
                {glicemie > 140 ? '⚠️ Hiperglicemie' : glicemie < 70 ? '⚠️ Hipoglicemie' : '✅ Nivel Normal'}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>mg/dL</div>
            </div>

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
              <button onClick={() => setGlicemie(prev => prev + 60)} style={{ flex: 1, background: '#ef5350', color: 'white', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}>⬆️ RAISE</button>
              <button onClick={() => setGlicemie(90)} style={{ background: '#eee', border: 'none', padding: '15px', borderRadius: '15px', cursor: 'pointer' }}>Reset</button>
              <button onClick={() => setGlicemie(prev => prev - 40)} style={{ flex: 1, background: '#42a5f5', color: 'white', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}>⬇️ REDUCE</button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY MODAL PRODUSE EXPIRATE */}
      {showExpiringModal && (
        <div className="modal-overlay">
          <div className="modal-content">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
               <h3 style={{ margin: 0, color: '#d32f2f', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={20}/> Expiră Curând!</h3>
               <button onClick={() => setShowExpiringModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24}/></button>
             </div>
             {expiringItems.length === 0 ? <p>Nu ai alerte.</p> : expiringItems.map(item => (
               <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px', background: '#fff3e0', padding: '15px', borderRadius: '15px' }}>
                 <img src={item.imagine} width="50" height="50" style={{ borderRadius: '10px', objectFit: 'cover' }} />
                 <div>
                   <strong style={{ fontSize: '15px' }}>{item.nume}</strong><br/>
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
            <div ref={videoRef} className="video-container">
              <div className="laser-line"></div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
              <label className="action-button">
                <Camera size={20} /> FĂ POZĂ
                <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              <label className="action-button">
                <ImageIcon size={20} /> GALERIE
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ marginTop: '20px', background: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 5px 20px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#1b5e20' }}>
                <Zap size={24} className={isProcessing ? "animate-pulse" : ""} />
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{ocrStatus}</span>
              </div>
              <h1 style={{ letterSpacing: '4px', color: '#333', margin: '15px 0' }}>{liveCode || "••••••••"}</h1>
            </div>
          </div>
        )}

        {/* --- REZULTAT SCANARE --- */}
        {scanResult && (
          <div style={{ background: 'white', padding: '25px', borderRadius: '25px', border: '3px solid #1b5e20', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', maxWidth: '500px', margin: '0 auto' }}>
            <img src={scanResult.imagine} style={{ width: '100px', display: 'block', margin: '0 auto 15px', borderRadius: '15px' }} />
            <h3 style={{ margin: '0', textAlign: 'center', fontSize: '1.2rem' }}>{scanResult.nume}</h3>
            <p style={{ color: '#666', textAlign: 'center', marginBottom: '20px', fontSize: '14px' }}>{scanResult.brand}</p>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <div style={{ flex: 1, background: '#e8f5e9', padding: '12px', borderRadius: '15px', textAlign: 'center' }}>
                <small>Energie/100g</small><br/><strong style={{fontSize: '1.1rem'}}>{scanResult.kcal} kcal</strong>
              </div>
              <div style={{ flex: 1, background: '#e8f5e9', padding: '12px', borderRadius: '15px', textAlign: 'center' }}>
                <small>Zaharuri/100g</small><br/><strong style={{fontSize: '1.1rem'}}>{scanResult.zaharuri} g</strong>
              </div>
            </div>

            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '20px', marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>PACHETE/BUCĂȚI:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                <button onClick={() => setTempCantitate(Math.max(1, tempCantitate - 1))} className="qty-button"><Minus size={20} /></button>
                <input type="number" value={tempCantitate} onChange={(e) => setTempCantitate(Number(e.target.value))} style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: 'bold', border: '2px solid #ddd', borderRadius: '12px', padding: '10px' }} />
                <button onClick={() => setTempCantitate(tempCantitate + 1)} className="qty-button-add"><Plus size={20} /></button>
              </div>

              <div className="grid-2-col">
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>GRAMAJ PER PACHET (g):</label>
                  <input type="number" value={tempGramaj} onChange={(e) => setTempGramaj(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #ddd', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>DATA EXPIRĂRII:</label>
                  <input type="date" value={tempExpirare} onChange={(e) => setTempExpirare(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #ddd', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            <button onClick={adaugaInFrigider} style={{ width: '100%', background: '#1b5e20', color: 'white', border: 'none', padding: '18px', borderRadius: '15px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>
              ADAUGĂ ÎN FRIGIDER
            </button>
            <button onClick={() => { setScanResult(null); setIsProcessing(false); setLiveCode(""); lastScannedCode.current = ""; startScanner(); }} style={{ width: '100%', border: 'none', background: 'none', color: '#888', marginTop: '15px', padding: '10px', cursor: 'pointer' }}>
              Anulează
            </button>
          </div>
        )}

        {/* ======================= TAB: FRIGIDER ======================= */}
        {activeTab === 'fridge' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, paddingLeft: '5px' }}>❄️ Frigiderul tău</h3>
              {expiringItems.length > 0 && (
                <button onClick={() => setShowExpiringModal(true)} style={{ background: '#ff9800', color: 'white', border: 'none', borderRadius: '10px', padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                  <AlertCircle size={18} /> {expiringItems.length} Alerte
                </button>
              )}
            </div>
            
            {fridge.length === 0 && <p style={{textAlign: 'center', color: '#999', marginTop: '40px'}}>Frigiderul e gol.</p>}
            
            <div className="responsive-grid">
              {fridge.map((item) => {
                const pericolCurent = checkAlergeniPericol(item.sursaText);
                const hasAlergiePericol = pericolCurent.length > 0;
                const isExpanded = expandedItems.includes(item.id);

                return (
                  <div key={item.id} className="card" style={{ background: hasAlergiePericol ? '#fff5f5' : 'white', border: hasAlergiePericol ? '3px solid #d32f2f' : '1px solid #eee' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <img src={item.imagine} width="60" height="60" style={{ borderRadius: '12px', marginRight: '15px', objectFit: 'cover' }} />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '1.1rem' }}>{item.nume}</strong><br/>
                        <small style={{color: '#888'}}>{item.brand}</small>
                        {item.expirare && <div style={{ fontSize: '12px', color: '#f57c00', marginTop: '5px', fontWeight: 'bold' }}>⏳ Exp: {new Date(item.expirare).toLocaleDateString('ro-RO')}</div>}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f0f2f5', borderRadius: '12px', padding: '8px' }}>
                        <button onClick={() => modificaCantitate(item.id, 1)} style={{ border: 'none', background: 'none', color: '#1b5e20', cursor: 'pointer' }}><Plus size={18} /></button>
                        <span style={{ fontWeight: 'bold', margin: '5px 0', fontSize: '16px' }}>x{item.cantitate}</span>
                        <button onClick={() => modificaCantitate(item.id, -1)} style={{ border: 'none', background: 'none', color: '#d32f2f', cursor: 'pointer' }}><Minus size={18} /></button>
                      </div>
                    </div>

                    {item.alergeniDetectati.length > 0 && (
                      <div style={{ display: 'inline-block', border: '1px solid #ef5350', color: '#c62828', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', marginTop: '12px', fontWeight: 'bold' }}>
                        Conține: {item.alergeniDetectati.join(', ')}
                      </div>
                    )}

                    {hasAlergiePericol && (
                      <div style={{ background: '#d32f2f', color: 'white', padding: '10px', borderRadius: '10px', marginTop: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={16} /> <strong>PERICOL SĂNĂTATE: {pericolCurent.join(', ')}</strong>
                      </div>
                    )}

                    <button onClick={() => toggleExpand(item.id)} style={{ width: '100%', background: '#f8f9fa', border: '1px solid #eee', borderRadius: '10px', color: '#666', padding: '8px', marginTop: '15px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '10px' }}>
                        <div style={{ marginBottom: '15px', background: '#f9f9f9', padding: '15px', borderRadius: '15px' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#555', marginBottom: '10px', fontWeight: 'bold' }}>
                             <span>MAI AI: {item.procentRamas}%</span>
                             <span>Din pachet ({item.gramajTotal}g)</span>
                           </div>
                           <input 
                             type="range" 
                             min="0" max="100" 
                             value={item.procentRamas}
                             onChange={(e) => actualizeazaProcentRamas(item.id, Number(e.target.value))}
                             style={{ width: '100%', accentColor: '#1b5e20', cursor: 'pointer' }}
                           />
                        </div>

                        <div style={{ fontSize: '14px', color: '#555', lineHeight: '1.8' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}><span>🔥 Calorii / 100g:</span> <strong>{item.kcal} kcal</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}><span>🍞 Carbohidrați:</span> <strong>{item.carbs} g</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}><span>🥩 Proteine:</span> <strong>{item.proteine} g</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}><span>🧈 Grăsimi:</span> <strong>{item.grasimi} g</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🧂 Sare:</span> <strong>{item.sare} g</strong></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================= TAB: HEALTH (ALERGENI) ======================= */}
        {activeTab === 'health' && (
          <div>
            <h3>🩺 Setări Alergeni</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>Selectează alergenii de evitat. Produsele din frigider care îi conțin vor fi marcate cu roșu.</p>
            
            <div className="alergeni-grid">
              {ALERGENI_COMUNI.map(alergen => {
                const isSelected = alergeniSelectati.includes(alergen);
                return (
                  <button 
                    key={alergen}
                    onClick={() => setAlergeniSelectati(prev => isSelected ? prev.filter(a => a !== alergen) : [...prev, alergen])}
                    style={{
                      padding: '15px', borderRadius: '15px', border: isSelected ? '2px solid #d32f2f' : '1px solid #ddd',
                      background: isSelected ? '#ffebee' : 'white', color: isSelected ? '#d32f2f' : '#333',
                      fontWeight: isSelected ? 'bold' : 'normal', transition: 'all 0.2s', cursor: 'pointer', fontSize: '15px'
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
            <div style={{ textAlign: 'center', background: 'white', padding: '30px', borderRadius: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
              <h3>🎯 Target Zilnic</h3>
              <div style={{ position: 'relative', width: '200px', height: '200px', margin: '20px auto' }}>
                <svg width="200" height="200">
                  <circle cx="100" cy="100" r="90" stroke="#eee" strokeWidth="15" fill="none" />
                  <circle cx="100" cy="100" r="90" stroke={dietKcalConsumed > dietKcalMax ? "#d32f2f" : "#1b5e20"} strokeWidth="15" fill="none"
                    strokeDasharray={565} 
                    strokeDashoffset={565 - (Math.min(dietKcalConsumed / dietKcalMax, 1) * 565)} 
                    strokeLinecap="round" transform="rotate(-90 100 100)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} 
                  />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: dietKcalConsumed > dietKcalMax ? '#d32f2f' : '#333' }}>{dietKcalConsumed}</div>
                  <div style={{ fontSize: '14px', color: '#888' }}>kcal</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                out of <input type="number" value={dietKcalMax} onChange={(e) => setDietKcalMax(Number(e.target.value))} style={{ width: '80px', textAlign: 'center', border: '2px solid #ccc', borderRadius: '8px', padding: '5px', fontWeight: 'bold' }} /> kcal
              </div>
              <p style={{ color: dietKcalConsumed > dietKcalMax ? '#d32f2f' : '#1b5e20', fontWeight: 'bold', marginTop: '15px', fontSize: '16px' }}>
                {dietKcalMax - dietKcalConsumed > 0 ? `${dietKcalMax - dietKcalConsumed} kcal left` : `Ai depășit cu ${dietKcalConsumed - dietKcalMax} kcal!`}
              </p>
              <button onClick={() => setDietKcalConsumed(0)} style={{ marginTop: '15px', padding: '10px 20px', background: '#f5f5f5', borderRadius: '10px', border: 'none', color: '#555', cursor: 'pointer', fontWeight: 'bold' }}>🔄 Resetează calorii</button>
            </div>

            <h4 style={{ paddingLeft: '5px', fontSize: '1.2rem' }}>🍽️ Mănâncă din Frigider</h4>
            {fridge.length === 0 && <p style={{ fontSize: '15px', color: '#888', textAlign: 'center' }}>Niciun produs disponibil.</p>}
            
            <div className="responsive-grid">
              {fridge.map(item => (
                <div key={item.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                    <div>
                      <strong style={{ fontSize: '16px' }}>{item.nume}</strong> <span style={{ fontSize: '13px', color: '#888' }}>(x{item.cantitate})</span><br/>
                      <small style={{ color: '#1b5e20', fontWeight: 'bold', fontSize: '14px' }}>{item.kcal} kcal / 100g</small>
                    </div>
                    <div style={{ fontSize: '13px', color: '#ef5350', fontWeight: 'bold', textAlign: 'right', background: '#ffebee', padding: '4px 8px', borderRadius: '8px' }}>
                      Stoc: {item.procentRamas}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <label style={{ position: 'absolute', top: '-10px', left: '10px', background: 'white', padding: '0 5px', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>Porție (g)</label>
                      <input 
                        type="number" 
                        value={portiiDiet[item.id] || 100} 
                        onChange={(e) => setPortiiDiet({...portiiDiet, [item.id]: Number(e.target.value)})}
                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #ccc', boxSizing: 'border-box', fontSize: '16px', fontWeight: 'bold' }}
                      />
                    </div>
                    <button onClick={() => consumaProdus(item)} style={{ background: '#e8f5e9', color: '#1b5e20', border: '2px solid #1b5e20', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                      CONSUMĂ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ======================= BOTTOM NAV ======================= */}
      <div style={{ height: '90px' }}></div> {/* Spacer pentru navigație */}
      <nav className="bottom-nav">
        <button className="nav-btn" onClick={() => setActiveTab('scan')} style={{ color: activeTab === 'scan' ? '#1b5e20' : '#888' }}>
          <Camera size={26} /><span>SCAN</span>
        </button>
        <button className="nav-btn" onClick={() => setActiveTab('fridge')} style={{ color: activeTab === 'fridge' ? '#1b5e20' : '#888' }}>
          <Refrigerator size={26} /><span>FRIGIDER</span>
        </button>
        <button className="nav-btn" onClick={() => setActiveTab('health')} style={{ color: activeTab === 'health' ? '#1b5e20' : '#888' }}>
          <Activity size={26} /><span>HEALTH</span>
        </button>
        <button className="nav-btn" onClick={() => setActiveTab('diet')} style={{ color: activeTab === 'diet' ? '#1b5e20' : '#888' }}>
          <PieChart size={26} /><span>DIET</span>
        </button>
      </nav>

     <style>{`
        /* RESPONSIVE LAYOUT */
        body { margin: 0; background: #e0e5ec; }
        .app-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          min-height: 100vh;
          background: #f4f6f9;
          font-family: 'Segoe UI', system-ui, sans-serif;
          position: relative;
          box-shadow: 0 0 30px rgba(0,0,0,0.1);
        }

        /* GRID SYSTEM PENTRU LISTE */
        .responsive-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
        }
        .alergeni-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }
        .grid-2-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        /* VIDEO CAMERA ADAPTIVĂ - FĂCUTĂ COMPACTĂ PENTRU TELEFON */
        .video-container {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          border: 4px solid #1b5e20;
          width: 100%;
          max-width: 350px; /* Limitează lățimea ca să nu fie un gigant */
          margin: 0 auto; /* Îl centrează pe ecran */
          aspect-ratio: 16/10; /* Face ecranul mai mult dreptunghiular decât pătrat */
          max-height: 220px; /* Taie din înălțime ca să încapă perfect fără scroll */
          background: #000;
          box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        video { width: 100%; height: 100%; object-fit: cover; }

        /* CARDURI COMUNE */
        .card {
          background: white;
          padding: 20px;
          border-radius: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.03);
          transition: transform 0.2s;
        }

        /* BOTTOM NAV CENTRAT */
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 800px;
          height: 80px;
          background: white;
          display: flex;
          justify-content: space-around;
          align-items: center;
          border-top: 1px solid #e0e0e0;
          z-index: 100;
          border-radius: 25px 25px 0 0;
          box-shadow: 0 -5px 20px rgba(0,0,0,0.05);
        }
        .nav-btn {
          border: none;
          background: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-btn span { font-size: 11px; font-weight: 800; letter-spacing: 0.5px; }
        .nav-btn:hover { transform: translateY(-3px); }

        /* BUTOANE SI INPUTURI */
        .action-button {
          flex: 1; background: #fff; color: #1b5e20; border: 2px solid #1b5e20; 
          padding: 12px; border-radius: 12px; font-weight: bold; cursor: pointer; 
          display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s;
        }
        .action-button:hover { background: #f1f8e9; }
        .qty-button { background: #eee; border: none; padding: 12px; border-radius: 12px; cursor: pointer; }
        .qty-button-add { background: #1b5e20; color: white; border: none; padding: 12px; border-radius: 12px; cursor: pointer; }
        
        /* MODALE ANIMATE */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
          background: rgba(0,0,0,0.6); z-index: 999; display: flex; 
          align-items: center; justify-content: center; padding: 20px;
          backdrop-filter: blur(5px);
        }
        .modal-content {
          background: white; width: 100%; max-width: 450px; 
          border-radius: 25px; padding: 25px; max-height: 85vh; 
          overflow-y: auto; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          animation: slideUp 0.3s ease-out;
        }

        /* ANIMATII */
        .laser-line { position: absolute; top: 50%; left: 5%; right: 5%; height: 2px; background: red; box-shadow: 0 0 15px red; z-index: 10; animation: scanAnim 2.5s infinite ease-in-out; }
        @keyframes scanAnim { 0%, 100% { top: 20%; } 50% { top: 80%; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        /* FIX CALENDAR ICON PE MOBIL */
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; transition: 0.2s; width: 20px; height: 20px; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
      `}</style>
    </div>
  );
}