import React, { useState, useEffect, useRef } from 'react';
import Quagga from '@ericblade/quagga2';
import Tesseract from 'tesseract.js';
import { Camera, Refrigerator, Activity, AlertTriangle, Trash2, Search, Zap, Image as ImageIcon, Plus, Minus, ChevronDown, ChevronUp, PieChart, HeartPulse, Bell, X, AlertCircle, ShoppingCart, CheckSquare, Square, Utensils } from 'lucide-react';

// --- CONFIGURARE FIREBASE ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCcQAma55Gggt1jOru36i_yNTXx7k0AKu0",
  authDomain: "frigiderhackaton.firebaseapp.com",
  projectId: "frigiderhackaton",
  storageBucket: "frigiderhackaton.firebasestorage.app",
  messagingSenderId: "837840134336",
  appId: "1:837840134336:web:eb404d9b0fdf2be0ab4d25",
  measurementId: "G-W879751WZR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// ----------------------------

// --- API SPOONACULAR ---
const SPOONACULAR_API_KEY = "3188391c43ee4d3cbc5972c4e7647f0c";

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

interface ShoppingItem {
  id: string;
  nume: string;
  bifat: boolean;
}

const ALERGENI_COMUNI = ['Lapte', 'Gluten', 'Ouă', 'Alune', 'Nuci', 'Soia', 'Pește', 'Fructe de mare', 'Țelină', 'Muștar'];

const BAZA_DATE_PROASPATA: Product[] = [
  { id: "raw-1", nume: "Ceapă proaspătă", brand: "Legume", kcal: 40, carbs: 9, zaharuri: 4.2, proteine: 1.1, grasimi: 0.1, sare: 0, sursaText: "ceapa onion", alergeniDetectati: [], imagine: "https://cdn-icons-png.flaticon.com/512/1135/1135520.png", cantitate: 1, expirare: "", gramajTotal: 100, procentRamas: 100 },
  { id: "raw-2", nume: "Mere (Fructe)", brand: "Fructe proaspete", kcal: 52, carbs: 14, zaharuri: 10.4, proteine: 0.3, grasimi: 0.2, sare: 0, sursaText: "mere mar apple", alergeniDetectati: [], imagine: "https://cdn-icons-png.flaticon.com/512/415/415682.png", cantitate: 1, expirare: "", gramajTotal: 100, procentRamas: 100 },
  { id: "raw-3", nume: "Banane", brand: "Fructe proaspete", kcal: 89, carbs: 23, zaharuri: 12.2, proteine: 1.1, grasimi: 0.3, sare: 0, sursaText: "banane banana", alergeniDetectati: [], imagine: "https://cdn-icons-png.flaticon.com/512/2909/2909808.png", cantitate: 1, expirare: "", gramajTotal: 100, procentRamas: 100 },
  { id: "raw-4", nume: "Roșii proaspete", brand: "Legume", kcal: 18, carbs: 3.9, zaharuri: 2.6, proteine: 0.9, grasimi: 0.2, sare: 0, sursaText: "rosii tomato", alergeniDetectati: [], imagine: "https://cdn-icons-png.flaticon.com/512/1202/1202125.png", cantitate: 1, expirare: "", gramajTotal: 100, procentRamas: 100 },
  { id: "raw-5", nume: "Cartofi cruzi", brand: "Legume", kcal: 77, carbs: 17.5, zaharuri: 0.8, proteine: 2, grasimi: 0.1, sare: 0, sursaText: "cartofi potato", alergeniDetectati: [], imagine: "https://cdn-icons-png.flaticon.com/512/1135/1135502.png", cantitate: 1, expirare: "", gramajTotal: 100, procentRamas: 100 },
  { id: "raw-6", nume: "Ouă (găină)", brand: "Proaspăt", kcal: 143, carbs: 0.7, zaharuri: 0.4, proteine: 13, grasimi: 9.5, sare: 0.3, sursaText: "oua ou egg", alergeniDetectati: ["Ouă"], imagine: "https://cdn-icons-png.flaticon.com/512/837/837560.png", cantitate: 30, expirare: "", gramajTotal: 50, procentRamas: 100 },
  { id: "raw-7", nume: "Pâine Albă", brand: "Brutărie", kcal: 265, carbs: 49, zaharuri: 5, proteine: 9, grasimi: 3.2, sare: 1.5, sursaText: "paine paine alba bread", alergeniDetectati: ["Gluten"], imagine: "https://cdn-icons-png.flaticon.com/512/3214/3214307.png", cantitate: 1, expirare: "", gramajTotal: 500, procentRamas: 100 },
  { id: "raw-8", nume: "Piept de pui crud", brand: "Carne", kcal: 165, carbs: 0, zaharuri: 0, proteine: 31, grasimi: 3.6, sare: 0.1, sursaText: "carne de pui piept", alergeniDetectati: [], imagine: "https://cdn-icons-png.flaticon.com/512/1895/1895685.png", cantitate: 1, expirare: "", gramajTotal: 500, procentRamas: 100 }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'fridge' | 'health' | 'diet' | 'shop'>('scan');
  
  const [fridge, setFridge] = useState<Product[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [shopInput, setShopInput] = useState("");

  const [scanResult, setScanResult] = useState<Product | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  const [liveCode, setLiveCode] = useState("");
  const [ocrStatus, setOcrStatus] = useState("Apropie codul de bare...");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  const [tempCantitate, setTempCantitate] = useState<number | string>(1);
  const [tempExpirare, setTempExpirare] = useState("");
  const [tempGramaj, setTempGramaj] = useState<number | string>(100);
  
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [alergeniSelectati, setAlergeniSelectati] = useState<string[]>([]);
  
  const [dietKcalMax, setDietKcalMax] = useState<number | string>(2500);
  const [dietKcalConsumed, setDietKcalConsumed] = useState(0);
  const [portiiDiet, setPortiiDiet] = useState<Record<string, number | string>>({});

  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [glicemie, setGlicemie] = useState(90);
  const [showExpiringModal, setShowExpiringModal] = useState(false);
  const [hideGlobalAlert, setHideGlobalAlert] = useState(false);

  // --- STATE-URI NOI PENTRU RETETE ---
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isFetchingRecipes, setIsFetchingRecipes] = useState(false);

  const videoRef = useRef<HTMLDivElement>(null);
  const lastScannedCode = useRef("");

  useEffect(() => { processingRef.current = isProcessing; }, [isProcessing]);

  // ==========================================
  // --- SINCRONIZARE FIREBASE (FRIGIDER & SHOP) ---
  // ==========================================
  useEffect(() => {
    const unsubFridge = onSnapshot(collection(db, "produse"), (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((doc) => { items.push(doc.data() as Product); });
      items.sort((a, b) => a.nume.localeCompare(b.nume));
      setFridge(items);
    });

    const unsubShop = onSnapshot(collection(db, "cumparaturi"), (snapshot) => {
      const items: ShoppingItem[] = [];
      snapshot.forEach((doc) => { 
        items.push({ id: doc.id, ...doc.data() } as ShoppingItem); 
      });
      setShoppingList(items);
    });

    return () => { unsubFridge(); unsubShop(); };
  }, []);

  // ==========================================
  // --- FETCH RETETE SPOONACULAR ---
  // ==========================================
  const fetchRecipes = async () => {
    if (fridge.length === 0) {
      alert("Nu ai alimente în frigider!");
      return;
    }
    
    setIsFetchingRecipes(true);
    try {
      // Scoatem doar prima parte a numelui din frigider ca sa inteleaga API-ul mai usor
      const rawIngredients = fridge.map(item => item.nume.split(' ')[0]).join(', ');
      
      // Il trecem printr-un translator simplu pt rezultate bune (Spoonacular iubeste engleza)
      let enIngredients = rawIngredients;
      try {
        const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(rawIngredients)}&langpair=ro|en`);
        const transData = await transRes.json();
        if (transData?.responseData?.translatedText) {
          enIngredients = transData.responseData.translatedText;
        }
      } catch (e) {
        console.warn("Eroare la traducere. Incerc cu termenii originali.");
      }

      // Ranking=2 este cheia: optimizeaza retetele pentru a minimiza ingredientele lipsa
      const res = await fetch(`https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(enIngredients)}&number=8&ranking=2&ignorePantry=true&apiKey=${SPOONACULAR_API_KEY}`);
      const data = await res.json();
      setRecipes(data);
    } catch (error) {
      alert("Eroare la conexiunea cu API-ul de rețete.");
    } finally {
      setIsFetchingRecipes(false);
    }
  };

  // ==========================================
  // --- SCANNER QUAGGA ---
  // ==========================================
  useEffect(() => {
    const shouldRunScanner = activeTab === 'scan' && !scanResult && searchResults.length === 0;
    if (shouldRunScanner) { startScanner(); } else { try { Quagga.stop(); } catch(e) {} }
    return () => { try { Quagga.stop(); } catch(e) {} };
  }, [activeTab, scanResult, searchResults.length]);

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
    Quagga.offDetected();
    Quagga.onDetected((data) => {
      const code = data.codeResult.code;
      if (code && code !== lastScannedCode.current && !processingRef.current) {
        lastScannedCode.current = code; setLiveCode(code); fetchProduct(code);
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true); setOcrStatus("Analizez poza... ⏳"); 
    setSearchResults([]); setSearchQuery("");
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', { // @ts-ignore
        tessedit_char_whitelist: '0123456789' 
      });
      const cleaned = text.replace(/\D/g, '').trim();
      if (cleaned.length >= 8) { setLiveCode(cleaned); fetchProduct(cleaned); } 
      else { setOcrStatus("Nu am văzut cifre clare. Mai încearcă!"); setIsProcessing(false); }
    } catch (err) { setOcrStatus("Eroare la procesarea pozei."); setIsProcessing(false); }
  };

  async function fetchProduct(barcode: string) {
    setIsProcessing(true); setOcrStatus("📦 Căutare produs...");
    setSearchResults([]); setSearchQuery("");
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
          kcal: p.nutriments?.['energy-kcal_100g'] || 0, carbs: p.nutriments?.carbohydrates_100g || 0,
          zaharuri: p.nutriments?.sugars_100g || 0, proteine: p.nutriments?.proteins_100g || 0,
          grasimi: p.nutriments?.fat_100g || 0, sare: p.nutriments?.salt_100g || 0,
          sursaText: sursa, alergeniDetectati: alergeniGasitiGlobal,
          imagine: p.image_front_small_url || "https://cdn-icons-png.flaticon.com/512/2917/2917992.png",
          cantitate: 1, expirare: "", gramajTotal: parsedGramaj, procentRamas: 100
        });
        setOcrStatus("✅ PRODUS GĂSIT!");
      } else { setOcrStatus("❌ Cod negăsit."); setTimeout(() => { lastScannedCode.current = ""; }, 2500); }
    } catch (e) { setOcrStatus("⚠️ Eroare rețea"); setTimeout(() => { lastScannedCode.current = ""; }, 2500); } finally { setIsProcessing(false); }
  }

  const searchProductManual = async (query: string) => {
    if (!query.trim()) return;
    setIsProcessing(true); setOcrStatus("🔍 Caut global...");
    setSearchResults([]); setScanResult(null);
    const qLower = query.trim().toLowerCase();
    if (/^\d+$/.test(qLower)) { await fetchProduct(qLower); return; }

    const localMatches = BAZA_DATE_PROASPATA.filter(p => p.sursaText.includes(qLower));
    let combiResults: Product[] = [...localMatches];

    try {
      const offRes = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(qLower)}&search_simple=1&action=process&json=1&page_size=4`);
      const offData = await offRes.json();
      if (offData.products) {
        const offMapped = offData.products.filter((p:any) => p.product_name).map((p:any) => {
          const sursa = [p.product_name, p.ingredients_text, p.brands].join(' ').toLowerCase();
          return {
            id: p.code || "off-" + Math.random(), nume: p.product_name, brand: p.brands || "Produs Ambalat",
            kcal: p.nutriments?.['energy-kcal_100g'] || 0, carbs: p.nutriments?.carbohydrates_100g || 0,
            zaharuri: p.nutriments?.sugars_100g || 0, proteine: p.nutriments?.proteins_100g || 0,
            grasimi: p.nutriments?.fat_100g || 0, sare: p.nutriments?.salt_100g || 0,
            sursaText: sursa, alergeniDetectati: ALERGENI_COMUNI.filter(a => sursa.includes(a.toLowerCase())),
            imagine: p.image_front_small_url || "https://cdn-icons-png.flaticon.com/512/2917/2917992.png",
            cantitate: 1, expirare: "", gramajTotal: 100, procentRamas: 100
          };
        });
        combiResults = [...combiResults, ...offMapped];
      }
    } catch(e) {}

    try {
      let enQuery = qLower;
      const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(qLower)}&langpair=ro|en`);
      const transData = await transRes.json();
      if (transData?.responseData?.translatedText) enQuery = transData.responseData.translatedText;

      const usdaRes = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=${encodeURIComponent(enQuery)}&pageSize=4`);
      const usdaData = await usdaRes.json();
      if (usdaData.foods) {
        const usdaMapped = usdaData.foods.map((p: any) => {
          const getNutr = (name: string) => p.foodNutrients.find((n:any) => n.nutrientName.includes(name))?.value || 0;
          return {
             id: "usda-" + p.fdcId, nume: p.description.toLowerCase().replace(/\b\w/g, (c:string) => c.toUpperCase()), brand: "Natural / Vrac",
             kcal: Math.round(getNutr("Energy")), carbs: Math.round(getNutr("Carbohydrate") * 10) / 10,
             zaharuri: Math.round(getNutr("Sugars") * 10) / 10, proteine: Math.round(getNutr("Protein") * 10) / 10,
             grasimi: Math.round(getNutr("Total lipid (fat)") * 10) / 10, sare: 0,
             sursaText: p.description.toLowerCase() + " " + qLower,
             alergeniDetectati: ALERGENI_COMUNI.filter(a => p.description.toLowerCase().includes(a.toLowerCase())),
             imagine: "https://cdn-icons-png.flaticon.com/512/1135/1135520.png", 
             cantitate: 1, expirare: "", gramajTotal: 100, procentRamas: 100
          };
        });
        if (usdaMapped.length > 0) usdaMapped[0].nume = qLower.charAt(0).toUpperCase() + qLower.slice(1) + " (Proaspăt)";
        combiResults = [...usdaMapped, ...combiResults]; 
      }
    } catch(e) {}

    setIsProcessing(false);
    if (combiResults.length > 0) {
       const uniqueResults = combiResults.filter((v, i, a) => a.findIndex(t => (t.nume === v.nume)) === i);
       setSearchResults(uniqueResults.slice(0, 7)); setOcrStatus("✅ Alege din listă:"); Quagga.stop();
    } else { setOcrStatus("❌ Negăsit."); setTimeout(() => { lastScannedCode.current = ""; }, 2000); }
  };

  const selectSearchResult = (item: Product) => {
    const isEgg = item.sursaText.includes('oua') || item.sursaText.includes('ouă') || item.sursaText.includes('egg');
    setTempCantitate(isEgg ? 30 : 1); setTempExpirare(""); setTempGramaj(item.gramajTotal);
    setScanResult(item); setSearchResults([]); setSearchQuery(""); setOcrStatus("✅ SELECTAT!");
  };

  // ==========================================
  // --- FUNCTII FIREBASE FRIGIDER ---
  // ==========================================
  const adaugaInFrigider = async () => {
    if (!scanResult) return;
    const finalCantitate = Number(tempCantitate) || 1;
    const finalGramaj = Number(tempGramaj) || 100;
    const existingItem = fridge.find(p => p.id === scanResult.id);
    const docRef = doc(db, "produse", scanResult.id.toString().replace(/\//g, '-'));
    try {
      if (existingItem) { await updateDoc(docRef, { cantitate: existingItem.cantitate + finalCantitate, expirare: tempExpirare || existingItem.expirare, gramajTotal: finalGramaj });
      } else { await setDoc(docRef, { ...scanResult, cantitate: finalCantitate, expirare: tempExpirare, gramajTotal: finalGramaj, procentRamas: 100 }); }
    } catch (e: any) { alert("⚠️ Eroare salvare: " + e.message); return; }
    setScanResult(null); setIsProcessing(false); setLiveCode(""); lastScannedCode.current = ""; setActiveTab('fridge');
  };

  const modificaCantitate = async (id: string, delta: number) => {
    const item = fridge.find(p => p.id === id); if (!item) return;
    const nouaCantitate = item.cantitate + delta;
    const docRef = doc(db, "produse", id.toString().replace(/\//g, '-'));
    try { if (nouaCantitate <= 0) { await deleteDoc(docRef); } else { await updateDoc(docRef, { cantitate: nouaCantitate }); } } catch (e: any) {}
  };

  const actualizeazaProcentRamas = async (id: string, procent: number) => {
    try { await updateDoc(doc(db, "produse", id.toString().replace(/\//g, '-')), { procentRamas: procent }); } catch (e: any) {}
  };

  const stergeProdusFinal = async (id: string) => {
    try { await deleteDoc(doc(db, "produse", id.toString().replace(/\//g, '-'))); } catch(e: any) {}
  }

  const consumaProdus = async (item: Product) => {
    const valPortie = portiiDiet[item.id];
    const grameConsumate = (valPortie !== undefined && valPortie !== '') ? Number(valPortie) : 100;
    setDietKcalConsumed(prev => Math.round(prev + (item.kcal / 100) * grameConsumate));
    let nouProcent = item.procentRamas - ((grameConsumate / item.gramajTotal) * 100);
    let nouaCantitate = item.cantitate;
    if (nouProcent <= 0) { nouaCantitate -= 1; nouProcent = nouaCantitate > 0 ? 100 : 0; }
    const docRef = doc(db, "produse", item.id.toString().replace(/\//g, '-'));
    try { if (nouaCantitate <= 0) { await deleteDoc(docRef); } else { await updateDoc(docRef, { procentRamas: Math.max(0, Math.round(nouProcent)), cantitate: nouaCantitate }); } } catch (e: any) {}
  };

  // ==========================================
  // --- FUNCTII FIREBASE SHOP ---
  // ==========================================
  const addShopItem = async () => {
    if (!shopInput.trim()) return;
    try {
      await addDoc(collection(db, "cumparaturi"), { nume: shopInput.trim(), bifat: false });
      setShopInput("");
    } catch (e: any) { alert("Eroare Adăugare Shop: " + e.message); }
  };

  const toggleShopItem = async (item: ShoppingItem) => {
    try { await updateDoc(doc(db, "cumparaturi", item.id), { bifat: !item.bifat }); } catch (e) {}
  };

  const deleteShopItem = async (id: string) => {
    try { await deleteDoc(doc(db, "cumparaturi", id)); } catch (e) {}
  };

  const clearCheckedItems = async () => {
    const checked = shoppingList.filter(i => i.bifat);
    for (const item of checked) { await deleteShopItem(item.id); }
  };

  const toggleExpand = (id: string) => setExpandedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const checkAlergeniPericol = (sursaText: string) => alergeniSelectati.filter(a => sursaText.includes(a.toLowerCase().replace('ă', 'a').replace('ș', 's').replace('ț', 't')));
  const getExpiringItems = () => { const now = new Date().getTime(); return fridge.filter(item => item.expirare && (new Date(item.expirare).getTime() - now) <= 48 * 60 * 60 * 1000); };
  const expiringItems = getExpiringItems();
  const genereazaRecomandareHipo = () => {
    const pz = [...fridge].filter(p => p.carbs > 0).sort((a, b) => b.carbs - a.carbs);
    if (pz.length === 0) return "Consumă urgent zahăr, miere sau un suc dulce.";
    return `Mănâncă ~${Math.round((15 * 100) / pz[0].carbs)}g de ${pz[0].nume} pentru 15g carbohidrați.`;
  };
  const safeDietMax = Number(dietKcalMax) || 1;

  return (
    <div className="app-container">
      
      <header style={{ background: '#1b5e20', color: 'white', padding: '15px 20px', textAlign: 'center', borderRadius: '0 0 20px 20px', position: 'relative', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
        
        {/* NOU: BUTON PENTRU MENIU RETETE (STANGA SUS) */}
        <button onClick={() => setIsRecipeModalOpen(true)} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', background: 'white', color: '#ff9800', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', cursor: 'pointer' }}>
          <Utensils size={20} />
        </button>

        <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)' }}>KitchenGuard AI 🥗</h2>
        
        <button onClick={() => setIsMonitorOpen(true)} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'white', color: '#d32f2f', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', cursor: 'pointer' }}>
          <HeartPulse size={20} />
        </button>
      </header>

      {/* --- NOU: OVERLAY MODAL PENTRU RETETE --- */}
      {isRecipeModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px', padding: '20px' }}>
            <button onClick={() => setIsRecipeModalOpen(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={24} /></button>
            <h3 style={{ marginTop: 0, color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}><Utensils size={22} color="#ff9800"/> Rețete cu ce ai</h3>
            <p style={{ fontSize: '13px', color: '#666', marginTop: '-10px', marginBottom: '20px' }}>Gătim inteligent cu produsele din frigider.</p>
            
            <button onClick={fetchRecipes} disabled={isFetchingRecipes} style={{ width: '100%', background: '#ff9800', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px', boxShadow: '0 4px 10px rgba(255, 152, 0, 0.2)' }}>
              {isFetchingRecipes ? "⏳ Analizez ingredientele..." : "🍳 GENEREAZĂ REȚETE"}
            </button>

            <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: '5px' }}>
              {recipes.length === 0 && !isFetchingRecipes && (
                <p style={{textAlign: 'center', color: '#888', fontSize: '13px', marginTop: '30px'}}>Apasă butonul de mai sus pentru a genera idei de mese!</p>
              )}
              {recipes.map((r: any) => (
                <div key={r.id} style={{ display: 'flex', gap: '12px', background: '#f9f9f9', padding: '10px', borderRadius: '12px', marginBottom: '10px', border: '1px solid #eee' }}>
                  <img src={r.image} alt={r.title} style={{ width: '75px', height: '75px', borderRadius: '10px', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '14px', color: '#333', display: 'block', lineHeight: '1.2', marginBottom: '6px' }}>{r.title}</strong>
                    <div style={{ fontSize: '11px', color: '#1b5e20', fontWeight: 'bold' }}>✅ Ai: {r.usedIngredientCount} ingrediente</div>
                    {r.missedIngredientCount > 0 && (
                      <div style={{ fontSize: '11px', color: '#d32f2f', fontWeight: 'bold' }}>❌ Îți lipsesc: {r.missedIngredientCount} ingrediente</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {expiringItems.length > 0 && !hideGlobalAlert && (
        <div style={{ background: '#ff9800', color: 'white', padding: '10px 15px', margin: '15px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}><Bell size={18} /> Atenție! Ai {expiringItems.length} produs(e) care expiră curând!</div>
          <button onClick={() => setHideGlobalAlert(true)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={18} /></button>
        </div>
      )}

      {isMonitorOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button onClick={() => setIsMonitorOpen(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={24} /></button>
            <h3 style={{ marginTop: 0, color: '#333' }}>Monitor Glicemie</h3>
            <div style={{ background: glicemie > 140 ? '#ffebee' : glicemie < 70 ? '#e3f2fd' : '#e8f5e9', border: `3px solid ${glicemie > 140 ? '#d32f2f' : glicemie < 70 ? '#1976d2' : '#1b5e20'}`, borderRadius: '20px', padding: '20px', margin: '20px 0', transition: 'all 0.3s', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: glicemie > 140 ? '#c62828' : glicemie < 70 ? '#1565c0' : '#1b5e20' }}>{glicemie}</div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', marginTop: '5px' }}>{glicemie > 140 ? '⚠️ Hiperglicemie' : glicemie < 70 ? '⚠️ Hipoglicemie' : '✅ Nivel Normal'}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>mg/dL</div>
            </div>
            {glicemie < 70 && (
              <div style={{ background: '#bbdefb', padding: '12px', borderRadius: '15px', textAlign: 'left', marginBottom: '15px', border: '1px solid #1976d2' }}>
                <strong style={{ color: '#0d47a1', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}><AlertCircle size={16}/> Alerta Scădere:</strong>
                <p style={{ fontSize: '12px', margin: '5px 0 0 0', color: '#0d47a1' }}>{genereazaRecomandareHipo()}</p>
              </div>
            )}
            {glicemie > 140 && (
              <div style={{ background: '#ffcdd2', padding: '12px', borderRadius: '15px', textAlign: 'left', marginBottom: '15px', border: '1px solid #d32f2f' }}>
                <strong style={{ color: '#b71c1c', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}><AlertCircle size={16}/> Alerta Creștere:</strong>
                <p style={{ fontSize: '12px', margin: '5px 0 0 0', color: '#b71c1c' }}>Evită produsele bogate în zaharuri și hidratează-te!</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setGlicemie(prev => prev + 60)} className="action-button" style={{background: '#ef5350', color: 'white', border: 'none'}}>⬆️ RAISE</button>
              <button onClick={() => setGlicemie(90)} className="qty-button-small">Reset</button>
              <button onClick={() => setGlicemie(prev => prev - 40)} className="action-button" style={{background: '#42a5f5', color: 'white', border: 'none'}}>⬇️ REDUCE</button>
            </div>
          </div>
        </div>
      )}

      {showExpiringModal && (
        <div className="modal-overlay">
          <div className="modal-content">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
               <h3 style={{ margin: 0, color: '#d32f2f', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}><AlertTriangle size={18}/> Expiră Curând!</h3>
               <button onClick={() => setShowExpiringModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20}/></button>
             </div>
             {expiringItems.length === 0 ? <p>Nu ai alerte.</p> : expiringItems.map(item => (
               <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', background: '#fff3e0', padding: '12px', borderRadius: '12px' }}>
                 <img src={item.imagine} width="40" height="40" style={{ borderRadius: '8px', objectFit: 'contain' }} />
                 <div><strong style={{ fontSize: '13px' }}>{item.nume}</strong><br/><small style={{ color: '#d32f2f', fontWeight: 'bold' }}>Data: {new Date(item.expirare).toLocaleDateString('ro-RO')}</small></div>
               </div>
             ))}
          </div>
        </div>
      )}

      <main style={{ padding: '15px' }}>
        
        {/* ======================= TAB: SCAN / SEARCH ======================= */}
        {activeTab === 'scan' && !scanResult && (
          <div style={{ textAlign: 'center' }}>
            {searchResults.length === 0 && <div ref={videoRef} className="video-container"><div className="laser-line"></div></div>}
            
            {searchResults.length === 0 && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <label className="action-button"><Camera size={18} /> FĂ POZĂ<input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: 'none' }} /></label>
                <label className="action-button"><ImageIcon size={18} /> GALERIE<input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} /></label>
              </div>
            )}

            <div style={{ marginTop: '15px', background: 'white', padding: '15px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <input type="text" placeholder="Caută (ex: mere, ceapă, lapte)..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchProductManual(searchQuery)} className="compact-input" style={{ background: '#f8f9fa' }} />
                <button onClick={() => searchProductManual(searchQuery)} className="action-button" style={{ flex: 'none', width: '50px', padding: '0', background: '#1b5e20', color: 'white' }}><Search size={20} /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#1b5e20' }}>
                <Zap size={20} className={isProcessing ? "animate-pulse" : ""} /><span style={{ fontWeight: 'bold', fontSize: '14px' }}>{ocrStatus}</span>
              </div>
              {liveCode && searchResults.length === 0 && <h1 style={{ letterSpacing: '4px', color: '#333', margin: '10px 0 0 0', fontSize: '1.5rem' }}>{liveCode}</h1>}
            </div>

            {searchResults.length > 0 && (
              <div className="search-results-list" style={{ marginTop: '15px', background: 'white', borderRadius: '15px', padding: '5px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '2px solid #f0f0f0' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>Rezultate căutare:</span>
                  <button onClick={() => { setSearchResults([]); startScanner(); }} style={{ background: 'none', border: 'none', color: '#d32f2f', fontWeight: 'bold', cursor: 'pointer' }}>Închide</button>
                </div>
                {searchResults.map((item, index) => (
                  <div key={index} onClick={() => selectSearchResult(item)} className="search-result-item" style={{ display: 'flex', alignItems: 'center', padding: '12px 10px', borderBottom: index < searchResults.length - 1 ? '1px solid #eee' : 'none', cursor: 'pointer', transition: 'background 0.2s', borderRadius: '10px' }}>
                    <img src={item.imagine} style={{ width: '45px', height: '45px', borderRadius: '8px', objectFit: 'contain', marginRight: '15px', border: '1px solid #ddd', background: '#fff' }} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <strong style={{ fontSize: '14px', color: '#333', display: 'block', lineHeight: '1.2' }}>{item.nume}</strong>
                      <span style={{ fontSize: '11px', color: '#888' }}>{item.brand} • {item.kcal} kcal/100g</span>
                    </div>
                    <div style={{ background: '#f1f8e9', color: '#1b5e20', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>Alege</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- REZULTAT SCANARE SAU SELECTIE MANUALĂ --- */}
        {scanResult && (
          <div className="scan-result-card">
            <img src={scanResult.imagine} style={{ width: '70px', height: '70px', display: 'block', margin: '0 auto 10px', borderRadius: '12px', objectFit: 'contain' }} />
            <h3 style={{ margin: '0 0 5px 0', textAlign: 'center', fontSize: '1.1rem', lineHeight: '1.2' }}>{scanResult.nume}</h3>
            <p style={{ color: '#666', textAlign: 'center', margin: '0 0 15px 0', fontSize: '12px' }}>{scanResult.brand}</p>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 1, background: '#e8f5e9', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                <small style={{fontSize: '10px', color: '#555'}}>Kcal/100g</small><br/><strong style={{fontSize: '14px', color: '#1b5e20'}}>{scanResult.kcal}</strong>
              </div>
              <div style={{ flex: 1, background: '#e8f5e9', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                <small style={{fontSize: '10px', color: '#555'}}>Zahar/100g</small><br/><strong style={{fontSize: '14px', color: '#1b5e20'}}>{scanResult.zaharuri}g</strong>
              </div>
            </div>

            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '15px', marginBottom: '15px', border: '1px solid #eee' }}>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '11px', marginBottom: '8px', color: '#555' }}>PACHETE/BUCĂȚI:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <button onClick={() => setTempCantitate(Math.max(1, (Number(tempCantitate)||0) - 1))} className="qty-button-small"><Minus size={16} /></button>
                <input type="number" value={tempCantitate} onChange={(e) => setTempCantitate(e.target.value === '' ? '' : Number(e.target.value))} style={{ flex: 1, textAlign: 'center', fontSize: '16px', fontWeight: 'bold', border: '1px solid #ddd', borderRadius: '10px', padding: '8px' }} />
                <button onClick={() => setTempCantitate((Number(tempCantitate)||0) + 1)} className="qty-button-small add"><Plus size={16} /></button>
              </div>

              <div className="grid-2-col-small">
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '10px', marginBottom: '5px', color: '#555' }}>GRAMAJ (g):</label>
                  <input type="number" value={tempGramaj} onChange={(e) => setTempGramaj(e.target.value === '' ? '' : Number(e.target.value))} className="compact-input" />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '10px', marginBottom: '5px', color: '#555' }}>DATA EXPIRĂRII:</label>
                  <input type="date" value={tempExpirare} onChange={(e) => setTempExpirare(e.target.value)} className="compact-input" />
                </div>
              </div>
            </div>

            <button onClick={adaugaInFrigider} style={{ width: '100%', background: '#1b5e20', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(27,94,32,0.2)' }}>ADAUGĂ ÎN CLOUD (FRIGIDER)</button>
            <button onClick={() => { setScanResult(null); setIsProcessing(false); setLiveCode(""); lastScannedCode.current = ""; startScanner(); }} style={{ width: '100%', border: 'none', background: 'none', color: '#888', marginTop: '10px', padding: '10px', cursor: 'pointer', fontSize: '13px' }}>Anulează</button>
          </div>
        )}

        {/* ======================= TAB: FRIGIDER ======================= */}
        {activeTab === 'fridge' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, paddingLeft: '5px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ❄️ Frigider Sincronizat
                <span style={{width: '8px', height: '8px', background: '#4CAF50', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 5px #4CAF50'}}></span>
              </h3>
              {expiringItems.length > 0 && (
                <button onClick={() => setShowExpiringModal(true)} style={{ background: '#ff9800', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                  <AlertCircle size={14} /> {expiringItems.length} Alerte
                </button>
              )}
            </div>
            
            {fridge.length === 0 && <p style={{textAlign: 'center', color: '#999', marginTop: '30px', fontSize: '14px'}}>Frigiderul e gol.</p>}
            
            <div className="responsive-grid">
              {fridge.map((item) => {
                const pericolCurent = checkAlergeniPericol(item.sursaText);
                const hasAlergiePericol = pericolCurent.length > 0;
                const isExpanded = expandedItems.includes(item.id);

                return (
                  <div key={item.id} className="card" style={{ background: hasAlergiePericol ? '#fff5f5' : 'white', border: hasAlergiePericol ? '2px solid #d32f2f' : '1px solid #eee', padding: '15px', position: 'relative' }}>
                    <button onClick={() => stergeProdusFinal(item.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#ffcdd2', cursor: 'pointer', padding: '5px' }}><Trash2 size={18} /></button>
                    <div style={{ display: 'flex', alignItems: 'center', paddingRight: '25px' }}>
                      <img src={item.imagine} width="50" height="50" style={{ borderRadius: '10px', marginRight: '12px', objectFit: 'contain' }} />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '15px' }}>{item.nume}</strong><br/>
                        <small style={{color: '#888', fontSize: '11px'}}>{item.brand}</small>
                        {item.expirare && <div style={{ fontSize: '11px', color: '#f57c00', marginTop: '4px', fontWeight: 'bold' }}>⏳ Exp: {new Date(item.expirare).toLocaleDateString('ro-RO')}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f0f2f5', borderRadius: '10px', padding: '6px' }}>
                        <button onClick={() => modificaCantitate(item.id, 1)} style={{ border: 'none', background: 'none', color: '#1b5e20', cursor: 'pointer' }}><Plus size={16} /></button>
                        <span style={{ fontWeight: 'bold', margin: '4px 0', fontSize: '14px' }}>x{item.cantitate}</span>
                        <button onClick={() => modificaCantitate(item.id, -1)} style={{ border: 'none', background: 'none', color: '#d32f2f', cursor: 'pointer' }}><Minus size={16} /></button>
                      </div>
                    </div>
                    {item.alergeniDetectati.length > 0 && <div style={{ display: 'inline-block', border: '1px solid #ef5350', color: '#c62828', padding: '3px 6px', borderRadius: '6px', fontSize: '10px', marginTop: '10px', fontWeight: 'bold' }}>Conține: {item.alergeniDetectati.join(', ')}</div>}
                    {hasAlergiePericol && <div style={{ background: '#d32f2f', color: 'white', padding: '8px', borderRadius: '8px', marginTop: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> <strong>PERICOL: {pericolCurent.join(', ')}</strong></div>}
                    <button onClick={() => toggleExpand(item.id)} style={{ width: '100%', background: '#f8f9fa', border: '1px solid #eee', borderRadius: '8px', color: '#666', padding: '6px', marginTop: '12px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #eee', paddingTop: '12px', marginTop: '10px' }}>
                        <div style={{ marginBottom: '12px', background: '#f9f9f9', padding: '12px', borderRadius: '10px' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '8px', fontWeight: 'bold' }}><span>MAI AI: {item.procentRamas}%</span><span>Pachet ({item.gramajTotal}g)</span></div>
                           <input type="range" min="0" max="100" value={item.procentRamas} onChange={(e) => actualizeazaProcentRamas(item.id, Number(e.target.value))} style={{ width: '100%', accentColor: '#1b5e20', cursor: 'pointer' }} />
                        </div>
                        <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.6' }}>
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

        {/* ======================= TAB: SHOP ======================= */}
        {activeTab === 'shop' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, paddingLeft: '5px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🛒 Listă Cumpărături
                <span style={{width: '8px', height: '8px', background: '#4CAF50', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 5px #4CAF50'}}></span>
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'white', padding: '15px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <input type="text" value={shopInput} onChange={e=>setShopInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addShopItem()} placeholder="Ex: Lapte, Pâine, Roșii..." className="compact-input" style={{flex: 1, background: '#f8f9fa'}}/>
              <button onClick={addShopItem} className="action-button" style={{flex: 'none', background: '#1b5e20', color: 'white', padding: '0 20px'}}><Plus size={24}/></button>
            </div>
            
            <div style={{ background: 'white', borderRadius: '15px', padding: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              {shoppingList.length === 0 && <p style={{textAlign: 'center', color: '#888', margin: '10px 0'}}>Nu ai nimic pe listă momentan.</p>}
              
              {shoppingList.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 10px', borderBottom: '1px solid #eee', transition: 'background 0.2s', borderRadius: '10px', background: item.bifat ? '#f9f9f9' : 'transparent' }}>
                  <button onClick={() => toggleShopItem(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '15px', display: 'flex', padding: 0 }}>
                    {item.bifat ? <CheckSquare color="#1b5e20" size={24}/> : <Square color="#ccc" size={24}/>}
                  </button>
                  <span style={{ flex: 1, fontSize: '16px', fontWeight: item.bifat ? 'normal' : 'bold', textDecoration: item.bifat ? 'line-through' : 'none', color: item.bifat ? '#aaa' : '#333' }}>
                    {item.nume}
                  </span>
                  <button onClick={() => deleteShopItem(item.id)} style={{ background: 'none', border: 'none', color: '#ffcdd2', cursor: 'pointer', display: 'flex', padding: '5px' }}>
                    <Trash2 size={20}/>
                  </button>
                </div>
              ))}

              {shoppingList.some(i => i.bifat) && (
                <button onClick={clearCheckedItems} style={{ width: '100%', padding: '14px', marginTop: '15px', background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '10px', color: '#d32f2f', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Trash2 size={18}/> Șterge produsele bifate
                </button>
              )}
            </div>
          </div>
        )}

        {/* ======================= TAB: HEALTH ======================= */}
        {activeTab === 'health' && (
          <div>
            <h3>🩺 Setări Alergeni</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>Selectează alergenii de evitat. Produsele care îi conțin vor fi marcate cu roșu.</p>
            <div className="alergeni-grid">
              {ALERGENI_COMUNI.map(alergen => {
                const isSelected = alergeniSelectati.includes(alergen);
                return (
                  <button key={alergen} onClick={() => setAlergeniSelectati(prev => isSelected ? prev.filter(a => a !== alergen) : [...prev, alergen])}
                    style={{ padding: '12px', borderRadius: '12px', border: isSelected ? '2px solid #d32f2f' : '1px solid #ddd', background: isSelected ? '#ffebee' : 'white', color: isSelected ? '#d32f2f' : '#333', fontWeight: isSelected ? 'bold' : 'normal', transition: 'all 0.2s', cursor: 'pointer', fontSize: '14px' }}>
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
              <h3 style={{marginTop: 0}}>🎯 Target Zilnic</h3>
              <div style={{ position: 'relative', width: '150px', height: '150px', margin: '15px auto' }}>
                <svg width="150" height="150">
                  <circle cx="75" cy="75" r="65" stroke="#eee" strokeWidth="12" fill="none" />
                  <circle cx="75" cy="75" r="65" stroke={dietKcalConsumed > safeDietMax ? "#d32f2f" : "#1b5e20"} strokeWidth="12" fill="none" strokeDasharray={408} strokeDashoffset={408 - (Math.min(dietKcalConsumed / safeDietMax, 1) * 408)} strokeLinecap="round" transform="rotate(-90 75 75)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '26px', fontWeight: 'bold', color: dietKcalConsumed > safeDietMax ? '#d32f2f' : '#333' }}>{dietKcalConsumed}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>kcal</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                out of <input type="number" value={dietKcalMax} onChange={(e) => setDietKcalMax(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '70px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '8px', padding: '6px', fontWeight: 'bold', fontSize: '14px' }} /> kcal
              </div>
              <p style={{ color: dietKcalConsumed > safeDietMax ? '#d32f2f' : '#1b5e20', fontWeight: 'bold', marginTop: '10px', fontSize: '14px' }}>{safeDietMax - dietKcalConsumed > 0 ? `${safeDietMax - dietKcalConsumed} kcal left` : `Ai depășit cu ${dietKcalConsumed - safeDietMax} kcal!`}</p>
              <button onClick={() => setDietKcalConsumed(0)} style={{ marginTop: '10px', padding: '8px 15px', background: '#f5f5f5', borderRadius: '8px', border: 'none', color: '#555', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>🔄 Resetează</button>
            </div>

            <h4 style={{ paddingLeft: '5px', fontSize: '1.1rem', margin: '0 0 15px 0' }}>🍽️ Mănâncă din Frigider</h4>
            {fridge.length === 0 && <p style={{ fontSize: '14px', color: '#888', textAlign: 'center' }}>Niciun produs disponibil.</p>}
            
            <div className="responsive-grid">
              {fridge.map(item => {
                const portieCurenta = portiiDiet[item.id] !== undefined ? portiiDiet[item.id] : 100;
                return (
                  <div key={item.id} className="card" style={{ padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <strong style={{ fontSize: '14px' }}>{item.nume}</strong> <span style={{ fontSize: '12px', color: '#888' }}>(x{item.cantitate})</span><br/>
                        <small style={{ color: '#1b5e20', fontWeight: 'bold', fontSize: '12px' }}>{item.kcal} kcal/100g</small>
                      </div>
                      <div style={{ fontSize: '11px', color: '#ef5350', fontWeight: 'bold', background: '#ffebee', padding: '4px 6px', borderRadius: '6px' }}>Stoc: {item.procentRamas}%</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <label style={{ position: 'absolute', top: '-8px', left: '8px', background: 'white', padding: '0 4px', fontSize: '10px', color: '#666', fontWeight: 'bold' }}>Porție (g)</label>
                        <input type="number" value={portieCurenta} onChange={(e) => setPortiiDiet({...portiiDiet, [item.id]: e.target.value === '' ? '' : Number(e.target.value)})} className="compact-input" style={{fontSize: '14px'}} />
                      </div>
                      <button onClick={() => consumaProdus(item)} style={{ background: '#e8f5e9', color: '#1b5e20', border: '2px solid #1b5e20', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>CONSUMĂ</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      <div style={{ height: '80px' }}></div>
      <nav className="bottom-nav">
        <button className="nav-btn" onClick={() => setActiveTab('scan')} style={{ color: activeTab === 'scan' ? '#1b5e20' : '#888' }}><Camera size={22} /><span>SCAN</span></button>
        <button className="nav-btn" onClick={() => setActiveTab('fridge')} style={{ color: activeTab === 'fridge' ? '#1b5e20' : '#888' }}><Refrigerator size={22} /><span>STOC</span></button>
        <button className="nav-btn" onClick={() => setActiveTab('shop')} style={{ color: activeTab === 'shop' ? '#1b5e20' : '#888' }}><ShoppingCart size={22} /><span>SHOP</span></button>
        <button className="nav-btn" onClick={() => setActiveTab('health')} style={{ color: activeTab === 'health' ? '#1b5e20' : '#888' }}><Activity size={22} /><span>HEALTH</span></button>
        <button className="nav-btn" onClick={() => setActiveTab('diet')} style={{ color: activeTab === 'diet' ? '#1b5e20' : '#888' }}><PieChart size={22} /><span>DIET</span></button>
      </nav>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #e0e5ec; }
        .app-container { width: 100%; max-width: 800px; margin: 0 auto; min-height: 100vh; background: #f4f6f9; font-family: 'Segoe UI', system-ui, sans-serif; position: relative; box-shadow: 0 0 30px rgba(0,0,0,0.1); }

        .responsive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .alergeni-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
        
        .scan-result-card { background: white; padding: 15px; border-radius: 20px; border: 2px solid #1b5e20; box-shadow: 0 8px 20px rgba(0,0,0,0.08); max-width: 400px; margin: 0 auto; }
        .grid-2-col-small { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .compact-input { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #ddd; box-sizing: border-box; font-size: 16px; }

        .video-container { position: relative; border-radius: 15px; overflow: hidden; border: 3px solid #1b5e20; width: 100%; max-width: 320px; margin: 0 auto; aspect-ratio: 16/10; max-height: 200px; background: #000; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        video { width: 100%; height: 100%; object-fit: cover; }

        .card { background: white; padding: 15px; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); transition: transform 0.2s; }
        .search-result-item:hover { background: #f8f9fa !important; }

        .bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 800px; height: 70px; background: white; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid #eee; z-index: 100; border-radius: 20px 20px 0 0; box-shadow: 0 -2px 15px rgba(0,0,0,0.05); }
        .nav-btn { border: none; background: none; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; padding: 0 5px;}
        .nav-btn span { font-size: 10px; font-weight: 800; }

        .action-button { flex: 1; background: #fff; color: #1b5e20; border: 2px solid #1b5e20; padding: 10px; border-radius: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; }
        .qty-button-small { background: #eee; border: none; padding: 10px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .qty-button-small.add { background: #1b5e20; color: white; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 15px; backdrop-filter: blur(3px); }
        .modal-content { background: white; width: 100%; max-width: 380px; border-radius: 20px; padding: 20px; max-height: 85vh; overflow-y: auto; position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: slideUp 0.3s ease-out; }

        .laser-line { position: absolute; top: 50%; left: 5%; right: 5%; height: 2px; background: red; box-shadow: 0 0 15px red; z-index: 10; animation: scanAnim 2s infinite ease-in-out; }
        @keyframes scanAnim { 0%, 100% { top: 20%; } 50% { top: 80%; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; width: 20px; height: 20px; }
      `}</style>
    </div>
  );
}