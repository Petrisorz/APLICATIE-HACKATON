import React, { useState, useEffect, useRef } from 'react';
import Quagga from '@ericblade/quagga2';
import Tesseract from 'tesseract.js';
import { Camera, Refrigerator, Activity, AlertTriangle, Trash2, Search, Zap, Image as ImageIcon } from 'lucide-react';

interface Product {
  id: string;
  nume: string;
  brand: string;
  kcal: number;
  carbs: number;
  zaharuri: number;
  alergeniDetectati: string[];
  imagine: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'fridge' | 'health'>('scan');
  const [fridge, setFridge] = useState<Product[]>([]);
  const [scanResult, setScanResult] = useState<Product | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveCode, setLiveCode] = useState("");
  const [ocrStatus, setOcrStatus] = useState("Apropie codul de bare...");

  const videoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScannedCode = useRef("");

  const userAlergeni = ['milk', 'lapte', 'lactose', 'gluten', 'wheat', 'alune', 'nuts'];

  // --- 1. SCANARE LIVE (QUAGGA2) ---
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
      inputStream: {
        type: "LiveStream",
        target: videoRef.current,
        constraints: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      decoder: {
        readers: ["ean_reader", "ean_8_reader", "upc_reader", "code_128_reader"]
      },
      locate: true
    }, (err) => {
      if (err) {
        setOcrStatus("Eroare cameră!");
        return;
      }
      Quagga.start();
      setOcrStatus("Vânez liniile codului... 🔍");
    });

    Quagga.onDetected((data) => {
      const code = data.codeResult.code;
      if (code && code !== lastScannedCode.current) {
        lastScannedCode.current = code;
        setLiveCode(code);
        fetchProduct(code);
      }
    });
  };

  // --- 2. ÎNCĂRCARE FOTO / GALERIE (TESSERACT) ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setOcrStatus("Analizez poza... ⏳");
    Quagga.stop(); // Oprim camera live ca să nu consume resurse

    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        // @ts-ignore
        tessedit_char_whitelist: '0123456789',
      });

      const cleaned = text.replace(/\D/g, '').trim();
      if (cleaned.length >= 8) {
        setLiveCode(cleaned);
        fetchProduct(cleaned);
      } else {
        setOcrStatus("Nu am văzut cifre clare. Mai încearcă!");
        setIsProcessing(false);
        startScanner();
      }
    } catch (err) {
      setOcrStatus("Eroare la procesarea pozei.");
      setIsProcessing(false);
      startScanner();
    }
  };

  // --- 3. API FETCH ---
  async function fetchProduct(barcode: string) {
    if (isProcessing && activeTab !== 'scan') return; 
    setIsProcessing(true);
    setOcrStatus("📦 Căutare produs...");

    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();

      if (data.status === 1) {
        const p = data.product;
        const sursa = [p.product_name, p.ingredients_text, p.brands].join(' ').toLowerCase();
        const gasiti = userAlergeni.filter(a => sursa.includes(a.toLowerCase()));

        setScanResult({
          id: barcode + Date.now(),
          nume: p.product_name || "Produs Necunoscut",
          brand: p.brands || "Brand Mixt",
          kcal: p.nutriments['energy-kcal_100g'] || 0,
          carbs: p.nutriments.carbohydrates_100g || 0,
          zaharuri: p.nutriments.sugars_100g || 0,
          alergeniDetectati: gasiti,
          imagine: p.image_front_small_url || "https://via.placeholder.com/150"
        });
        setOcrStatus("✅ PRODUS GĂSIT!");
        Quagga.stop();
      } else {
        setOcrStatus("❌ Cod negăsit: " + barcode);
        setIsProcessing(false);
        lastScannedCode.current = "";
        if (activeTab === 'scan') startScanner();
      }
    } catch (e) {
      setOcrStatus("⚠️ Eroare rețea");
      setIsProcessing(false);
    }
  }

  return (
    <div style={{ maxWidth: '450px', margin: '0 auto', minHeight: '100vh', background: '#f0f2f5', fontFamily: 'sans-serif', paddingBottom: '90px' }}>
      
      <header style={{ background: '#1b5e20', color: 'white', padding: '20px', textAlign: 'center', borderRadius: '0 0 20px 20px' }}>
        <h2 style={{ margin: 0 }}>KitchenGuard AI 🥗</h2>
      </header>

      <main style={{ padding: '20px' }}>
        
        {activeTab === 'scan' && !scanResult && (
          <div style={{ textAlign: 'center' }}>
            <div ref={videoRef} style={{ 
              position: 'relative', 
              borderRadius: '30px', 
              overflow: 'hidden', 
              border: '5px solid #1b5e20', 
              height: '320px', 
              background: '#000' 
            }}>
              <div className="laser-line"></div>
            </div>

            {/* BUTOANE POZE */}
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

        {scanResult && (
          <div style={{ background: 'white', padding: '25px', borderRadius: '25px', border: '2px solid #1b5e20' }}>
            <img src={scanResult.imagine} style={{ width: '100px', display: 'block', margin: '0 auto 15px', borderRadius: '15px' }} />
            <h2 style={{ margin: '0', textAlign: 'center' }}>{scanResult.nume}</h2>
            <p style={{ color: '#666', textAlign: 'center', marginBottom: '15px' }}>{scanResult.brand}</p>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 1, background: '#e8f5e9', padding: '10px', borderRadius: '15px', textAlign: 'center' }}>
                <small>Energie</small><br/><strong>{scanResult.kcal} kcal</strong>
              </div>
              <div style={{ flex: 1, background: '#e8f5e9', padding: '10px', borderRadius: '15px', textAlign: 'center' }}>
                <small>Zaharuri</small><br/><strong>{scanResult.zaharuri} g</strong>
              </div>
            </div>

            {scanResult.alergeniDetectati.length > 0 && (
              <div style={{ background: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} /> <strong>ALERGENI: {scanResult.alergeniDetectati.join(', ')}</strong>
              </div>
            )}

            <button 
              onClick={() => { setFridge([...fridge, scanResult]); setScanResult(null); setIsProcessing(false); setLiveCode(""); setActiveTab('fridge'); }}
              style={{ width: '100%', background: '#1b5e20', color: 'white', border: 'none', padding: '16px', borderRadius: '15px', fontWeight: 'bold' }}
            > ADAUGĂ ÎN STOC </button>
            <button onClick={() => { setScanResult(null); setIsProcessing(false); setLiveCode(""); lastScannedCode.current = ""; startScanner(); }} style={{ width: '100%', border: 'none', background: 'none', color: '#888', marginTop: '10px' }}>Anulează</button>
          </div>
        )}

        {activeTab === 'fridge' && (
          <div>
            <h3 style={{ paddingLeft: '5px' }}>📦 Produsele tale</h3>
            {fridge.length === 0 && <p style={{textAlign: 'center', color: '#999', marginTop: '20px'}}>Frigiderul e gol.</p>}
            {fridge.map((item, idx) => (
              <div key={item.id + idx} style={{ background: 'white', display: 'flex', alignItems: 'center', padding: '15px', borderRadius: '15px', marginBottom: '10px' }}>
                <img src={item.imagine} width="45" height="45" style={{ borderRadius: '8px', marginRight: '15px', objectFit: 'cover' }} />
                <div style={{ flex: 1 }}><strong>{item.nume}</strong><br/><small style={{color: '#888'}}>{item.brand}</small></div>
                <button onClick={() => setFridge(fridge.filter((_, i) => i !== idx))} style={{ color: '#f44336', background: 'none', border: 'none' }}><Trash2 size={20} /></button>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: 0, width: '100%', maxWidth: '450px', height: '75px', background: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #ddd', zIndex: 100 }}>
        <button onClick={() => setActiveTab('scan')} style={{ border: 'none', background: 'none', color: activeTab === 'scan' ? '#1b5e20' : '#ccc' }}>
          <Camera /><br/><span style={{fontSize: '10px'}}>SCAN</span>
        </button>
        <button onClick={() => setActiveTab('fridge')} style={{ border: 'none', background: 'none', color: activeTab === 'fridge' ? '#1b5e20' : '#ccc' }}>
          <Refrigerator /><br/><span style={{fontSize: '10px'}}>STOC</span>
        </button>
        <button onClick={() => setActiveTab('health')} style={{ border: 'none', background: 'none', color: activeTab === 'health' ? '#1b5e20' : '#ccc' }}>
          <Activity /><br/><span style={{fontSize: '10px'}}>HEALTH</span>
        </button>
      </nav>

      <style>{`
        .laser-line {
          position: absolute;
          top: 50%; left: 5%; right: 5%;
          height: 2px; background: red;
          box-shadow: 0 0 10px red;
          z-index: 10;
          animation: scanAnim 2.5s infinite ease-in-out;
        }
        @keyframes scanAnim {
          0%, 100% { top: 30%; }
          50% { top: 70%; }
        }
        video { width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </div>
  );
}