import React, { useState, useEffect, useRef } from 'react';
import Quagga from '@ericblade/quagga2';
import Tesseract from 'tesseract.js';
import { Camera, Refrigerator, Activity, AlertTriangle, Trash2, Search, Zap } from 'lucide-react';

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

  // --- METODA 1: QUAGGA2 (Linii Barcode) ---
  useEffect(() => {
    if (activeTab === 'scan' && !scanResult) {
      startScanner();
    } else {
      Quagga.stop();
    }
    return () => Quagga.stop();
  }, [activeTab, scanResult]);

  const startScanner = () => {
    if (!videoRef.current) return;

    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoRef.current,
        constraints: {
          facingMode: "environment",
          aspectRatio: { min: 1, max: 2 },
          width: { ideal: 1280 }
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

  // --- METODA 2: TESSERACT (Cifre Rezervă) ---
  // Această funcție rulează în paralel la fiecare 2 secunde doar dacă Quagga nu prinde liniile
  const fallbackOCR = async () => {
    if (isProcessing || !canvasRef.current || scanResult) return;

    const video = videoRef.current?.querySelector('video');
    if (!video) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Crop pe zona centrală unde sunt cifrele
    ctx.drawImage(video, 400, 300, 480, 120, 0, 0, 400, 100);
    
    try {
      const { data: { text } } = await Tesseract.recognize(canvasRef.current, 'eng', {
        // @ts-ignore
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '7'
      });
      const cleaned = text.replace(/\D/g, '');
      if (cleaned.length >= 8 && cleaned !== lastScannedCode.current) {
        setOcrStatus("Detectat prin OCR (cifre)...");
        fetchProduct(cleaned);
      }
    } catch (e) { /* ignore ocr errors */ }
  };

  useEffect(() => {
    const timer = setInterval(fallbackOCR, 2000);
    return () => clearInterval(timer);
  }, [scanResult, isProcessing]);

  // --- API FETCH ---
  async function fetchProduct(barcode: string) {
    if (isProcessing) return;
    setIsProcessing(true);
    setOcrStatus("📦 Caut în baza de date...");

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
        setOcrStatus("❌ Cod necunoscut: " + barcode);
        setIsProcessing(false);
        lastScannedCode.current = ""; // Permite re-scanarea
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
              height: '350px', 
              background: '#000' 
            }}>
              {/* Linie Laser Animată */}
              <div className="laser-line"></div>
              <canvas ref={canvasRef} width="400" height="100" style={{ display: 'none' }} />
            </div>

            <div style={{ marginTop: '20px', background: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#1b5e20' }}>
                <Zap size={20} />
                <span style={{ fontWeight: 'bold' }}>{ocrStatus}</span>
              </div>
              <h1 style={{ letterSpacing: '5px', color: '#333' }}>{liveCode || "••••••••"}</h1>
            </div>
          </div>
        )}

        {scanResult && (
          <div style={{ background: 'white', padding: '25px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', border: '2px solid #1b5e20' }}>
            <img src={scanResult.imagine} style={{ width: '100px', display: 'block', margin: '0 auto 15px', borderRadius: '15px' }} />
            <h2 style={{ margin: '0 0 5px 0', textAlign: 'center' }}>{scanResult.nume}</h2>
            <p style={{ color: '#666', textAlign: 'center', marginBottom: '20px' }}>{scanResult.brand}</p>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <div style={{ flex: 1, background: '#e8f5e9', padding: '10px', borderRadius: '15px', textAlign: 'center' }}>
                <small>Energie</small><br/><strong>{scanResult.kcal} kcal</strong>
              </div>
              <div style={{ flex: 1, background: '#e8f5e9', padding: '10px', borderRadius: '15px', textAlign: 'center' }}>
                <small>Zaharuri</small><br/><strong>{scanResult.zaharuri}g</strong>
              </div>
            </div>

            {scanResult.alergeniDetectati.length > 0 && (
              <div style={{ background: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '15px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle /> <strong>ATENȚIE: {scanResult.alergeniDetectati.join(', ')}</strong>
              </div>
            )}

            <button 
              onClick={() => { setFridge([...fridge, scanResult]); setScanResult(null); setIsProcessing(false); setLiveCode(""); setActiveTab('fridge'); }}
              style={{ width: '100%', background: '#1b5e20', color: 'white', border: 'none', padding: '18px', borderRadius: '15px', fontWeight: 'bold', fontSize: '16px' }}
            > ADAUGĂ ÎN FRIGIDER </button>
            
            <button 
              onClick={() => { setScanResult(null); setIsProcessing(false); setLiveCode(""); lastScannedCode.current = ""; }}
              style={{ width: '100%', background: 'none', border: 'none', color: '#888', marginTop: '10px' }}
            > Reîncearcă scanarea </button>
          </div>
        )}

        {activeTab === 'fridge' && (
          <div>
            <h3>📦 Produse în Stoc</h3>
            {fridge.map((item, idx) => (
              <div key={idx} style={{ background: 'white', display: 'flex', alignItems: 'center', padding: '15px', borderRadius: '15px', marginBottom: '10px' }}>
                <img src={item.imagine} width="50" style={{ borderRadius: '10px', marginRight: '15px' }} />
                <div style={{ flex: 1 }}><strong>{item.nume}</strong><br/><small>{item.brand}</small></div>
                <button onClick={() => setFridge(fridge.filter((_, i) => i !== idx))} style={{ color: '#f44336', background: 'none', border: 'none' }}><Trash2 /></button>
              </div>
            ))}
          </div>
        )}

      </main>

      <nav style={{ position: 'fixed', bottom: 0, width: '100%', maxWidth: '450px', height: '80px', background: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #ddd' }}>
        <button onClick={() => setActiveTab('scan')} style={{ border: 'none', background: 'none', color: activeTab === 'scan' ? '#1b5e20' : '#ccc' }}>
          <Camera /><br/><small>SCAN</small>
        </button>
        <button onClick={() => setActiveTab('fridge')} style={{ border: 'none', background: 'none', color: activeTab === 'fridge' ? '#1b5e20' : '#ccc' }}>
          <Refrigerator /><br/><small>STOC</small>
        </button>
        <button onClick={() => setActiveTab('health')} style={{ border: 'none', background: 'none', color: activeTab === 'health' ? '#1b5e20' : '#ccc' }}>
          <Activity /><br/><small>HEALTH</small>
        </button>
      </nav>

      <style>{`
        .laser-line {
          position: absolute;
          top: 50%;
          left: 5%;
          right: 5%;
          height: 3px;
          background: red;
          box-shadow: 0 0 15px red;
          z-index: 10;
          animation: scanAnim 2s infinite ease-in-out;
        }
        @keyframes scanAnim {
          0% { top: 30%; opacity: 0.3; }
          50% { top: 70%; opacity: 1; }
          100% { top: 30%; opacity: 0.3; }
        }
        video { width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </div>
  );
}