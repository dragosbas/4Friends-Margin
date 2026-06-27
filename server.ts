import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request limit for base64 image uploads (crucial for phone camera captures)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Endpoint to scan invoice image
app.post("/api/scan-invoice", async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image || !mimeType) {
      return res.status(400).json({ error: "Lipseste imaginea sau tipul MIME (image & mimeType are required)" });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `Analizează această factură de la un furnizor și extrage datele structurate în format JSON. Te rog să returnezi detalii despre furnizor, numărul facturii, data facturii și o listă cu produsele/materiile prime achiziționate. 
    Asigură-te că prețurile sunt exprimate în RON (lei). 
    Identifică cu atenție:
    - Numele furnizorului (furnizor / issuer / supplier)
    - Numărul facturii (invoice number / serie si numar)
    - Data emiterii facturii (invoice date)
    - Pentru fiecare articol/materie primă (items):
      - numele articolului (name)
      - cantitatea (quantity)
      - prețul unitar fără TVA (unitPriceBeforeVat)
      - procentul TVA (vatPercent, ex: 11 pentru alimente/platouri, 21 pentru non-alimentare/zahăr/alcool/altele)
      - unitatea de măsură (unitOfMeasure, ex: kg, l, buc, etc.)
      - valoarea totală fără TVA (totalPriceBeforeVat)
    
    Te rog să folosești limba română pentru denumirile articolelor unde este posibil.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplierName: {
              type: Type.STRING,
              description: "Numele furnizorului care a emis factura",
            },
            invoiceNumber: {
              type: Type.STRING,
              description: "Numărul sau seria și numărul facturii",
            },
            invoiceDate: {
              type: Type.STRING,
              description: "Data emiterii facturii în format YYYY-MM-DD sau textul original",
            },
            items: {
              type: Type.ARRAY,
              description: "Lista de articole/materii prime din factură",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Denumirea produsului sau a materiei prime" },
                  quantity: { type: Type.NUMBER, description: "Cantitatea achiziționată" },
                  unitOfMeasure: { type: Type.STRING, description: "Unitatea de măsură (ex: kg, buc, l)" },
                  unitPriceBeforeVat: { type: Type.NUMBER, description: "Prețul unitar fără TVA (RON)" },
                  vatPercent: { type: Type.NUMBER, description: "Procentul de TVA aplicat (ex: 11 sau 21)" },
                  totalPriceBeforeVat: { type: Type.NUMBER, description: "Valoarea totală fără TVA (RON)" },
                },
                required: ["name", "quantity", "unitPriceBeforeVat"],
              },
            },
          },
          required: ["supplierName", "invoiceNumber", "invoiceDate", "items"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Nu s-a putut genera un răspuns de la Gemini");
    }

    const parsedData = JSON.parse(text.trim());
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("Eroare la scanarea facturii:", error);
    return res.status(500).json({ error: error.message || "Eroare internă la procesarea facturii cu AI" });
  }
});

// --- ANAF SPV OAUTH FLOW ENDPOINTS ---

// 1. Get OAuth Authorization URL
app.get("/api/auth/anaf/url", (req, res) => {
  const isReal = !!(process.env.ANAF_CLIENT_ID && process.env.ANAF_CLIENT_SECRET);
  const host = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${host}/api/auth/anaf/callback`;

  if (isReal) {
    // Redirect to real ANAF Production OAuth authorization portal
    const url = `https://logincert.anaf.ro/anaf-oauth2/v1/authorize?response_type=code&client_id=${process.env.ANAF_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=active`;
    return res.redirect(url);
  } else {
    // Redirect to our interactive ANAF SPV OAuth Simulator
    return res.redirect(`/api/auth/anaf/simulate-portal?redirect_uri=${encodeURIComponent(redirectUri)}`);
  }
});

// 2. Interactive ANAF SPV OAuth Simulator Portal
app.get("/api/auth/anaf/simulate-portal", (req, res) => {
  const redirectUri = req.query.redirect_uri ? String(req.query.redirect_uri) : "/api/auth/anaf/callback";
  
  res.send(`
    <!DOCTYPE html>
    <html lang="ro">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Portal de Autentificare ANAF SPV - Serviciul de Certificare Guvernamentală</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <style>
        .anaf-gradient {
          background: linear-gradient(135deg, #1e3a8a 0%, #0d9488 100%);
        }
      </style>
    </head>
    <body class="bg-slate-100 min-h-screen font-sans flex flex-col justify-between">
      
      <!-- Header -->
      <header class="bg-blue-900 text-white shadow-md">
        <div class="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="bg-white/10 p-2 rounded-lg">
              <span class="text-xl font-bold tracking-wider text-yellow-400 flex items-center gap-1">
                <span>RO</span>
                <span class="text-white text-xs">|</span>
                <span class="text-blue-200">MF</span>
              </span>
            </div>
            <div>
              <h1 class="text-sm font-bold tracking-wide uppercase">Ministerul Finanțelor</h1>
              <p class="text-[10px] text-blue-200 uppercase tracking-widest">Spațiul Privat Virtual (SPV) API Gateway</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 text-xs text-blue-200 bg-blue-950 px-3 py-1.5 rounded-full border border-blue-800">
            <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>Server Conexiune Securizată TLS 1.3</span>
          </div>
        </div>
      </header>

      <!-- Main Container -->
      <main class="max-w-xl mx-auto w-full px-6 py-8 flex-1 flex items-center justify-center">
        <div class="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200/80 w-full">
          
          <!-- Banner -->
          <div class="anaf-gradient text-white p-6 relative">
            <div class="absolute right-6 top-6 opacity-10">
              <svg class="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
            </div>
            <span class="bg-blue-950/40 text-yellow-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">OAuth 2.0 Client Consent</span>
            <h2 class="text-lg font-bold mt-2">Autorizare Acces Aplicație</h2>
            <p class="text-xs text-blue-100 mt-1 leading-relaxed">
              Aplicația <strong class="text-white">4Friends Margin (Profitability Calculator)</strong> solicită permisiunea de a descărca automat facturile primite (XML E-Factura) în numele companiei dumneavoastră.
            </p>
          </div>

          <form action="${redirectUri}" method="GET" class="p-6">
            <input type="hidden" name="code" value="simulated_auth_code_${Math.floor(Math.random() * 100000)}">
            
            <div class="space-y-4">
              <!-- Certifying Authority Selection -->
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Furnizor Certificat Digital / Semnătură Electonică</label>
                <select name="provider" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="certsign">certSIGN (USB Token / Cloud Sign)</option>
                  <option value="transsped">Trans Sped (Semnătură în Cloud)</option>
                  <option value="digisign">DigiSign (Certificat Digital)</option>
                  <option value="alfatrust">AlfaTrust Certification</option>
                  <option value="namirial">Namirial Group Romania</option>
                  <option value="simulated">Certificat Virtual (Demo Sandbox)</option>
                </select>
              </div>

              <!-- Company Information -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">CUI / CIF Companie</label>
                  <input type="text" name="cif" required value="RO39281920" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Denumire Companie</label>
                  <input type="text" name="company" required value="Almada Invest SRL" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
              </div>

              <!-- Information Note -->
              <div class="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-blue-800 leading-relaxed">
                <svg class="w-4 h-4 text-blue-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                </svg>
                <div>
                  Conexiunea securizată se stabilește prin protocolul securizat ANAF OAuth. Tokenul de acces va avea o valabilitate de exact <strong>90 de zile</strong>, conform reglementărilor legale ANAF, și va putea fi reînnoit oricând.
                </div>
              </div>
            </div>

            <!-- Submit Buttons -->
            <div class="mt-6 flex flex-col gap-2">
              <button type="submit" class="w-full py-3 px-4 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 cursor-pointer">
                <span>Semnează digital & Autorizează Conexiunea</span>
              </button>
              <button type="button" onclick="window.close()" class="w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-semibold text-xs rounded-xl transition-all cursor-pointer">
                Anulează
              </button>
            </div>
          </form>

        </div>
      </main>

      <!-- Footer -->
      <footer class="bg-slate-900 text-slate-500 text-[10px] text-center py-4 border-t border-slate-800 shrink-0">
        <p>&copy; 2026 Ministerul Finanțelor Publice - Serviciul Public Virtual. Toate drepturile rezervate.</p>
        <p class="mt-1 text-slate-600">Servicii electronice guvernamentale securizate prin Standardul Național de Identitate Digitală.</p>
      </footer>

    </body>
    </html>
  `);
});

// 3. OAuth Callback handler
app.get("/api/auth/anaf/callback", (req, res) => {
  const { company, cif } = req.query;
  const companyName = company ? String(company) : "Almada Invest SRL";
  const companyCif = cif ? String(cif) : "RO39281920";
  
  // Set expiration date exactly 90 days from now
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  res.send(`
    <!DOCTYPE html>
    <html lang="ro">
    <head>
      <meta charset="UTF-8">
      <title>Conexiune SPV Autorizată - ANAF OAuth 2.0</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    </head>
    <body class="bg-slate-50 min-h-screen flex flex-col items-center justify-center p-6 font-sans">
      <div class="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center">
        <div class="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
          <svg class="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h2 class="text-xl font-bold text-slate-950 mb-1">Autorizare OAuth Completă!</h2>
        <p class="text-slate-500 text-xs mb-6">
          S-a realizat conexiunea securizată cu ANAF SPV API pentru firma:
        </p>
        
        <div class="bg-slate-50 rounded-2xl p-4 text-left border border-slate-100 mb-6 text-xs space-y-2">
          <div class="flex justify-between py-1.5 border-b border-slate-200/60 text-slate-500">
            <span class="font-medium">Companie autorizată:</span>
            <strong class="text-slate-900 font-bold">${companyName}</strong>
          </div>
          <div class="flex justify-between py-1.5 border-b border-slate-200/60 text-slate-500">
            <span class="font-medium">CUI / CIF:</span>
            <span class="text-slate-700 font-semibold">${companyCif}</span>
          </div>
          <div class="flex justify-between py-1.5 border-b border-slate-200/60 text-slate-500">
            <span class="font-medium">Status Token:</span>
            <span class="text-emerald-600 font-bold flex items-center gap-1">
              <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              ACTIV (90 Zile)
            </span>
          </div>
          <div class="flex justify-between py-1.5 text-slate-500">
            <span class="font-medium">Data Expirării Token-ului:</span>
            <span class="text-indigo-600 font-semibold">${expiresAt}</span>
          </div>
        </div>
        
        <div class="flex items-center justify-center gap-2 text-xs text-slate-400">
          <svg class="animate-spin h-3.5 w-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Se salvează conexiunea securizată...</span>
        </div>
      </div>

      <script>
        // Write credentials directly to localStorage on the shared origin
        try {
          localStorage.setItem("anaf_connected", "true");
          localStorage.setItem("anaf_company", "${companyName}");
          localStorage.setItem("anaf_cif", "${companyCif}");
          localStorage.setItem("anaf_expires_at", "${expiresAt}");
        } catch (e) {
          console.error("Local storage error in popup:", e);
        }

        // Post to BroadcastChannel so the parent window in the iframe receives it instantly
        try {
          const bc = new BroadcastChannel('anaf_oauth_channel');
          bc.postMessage({
            type: "OAUTH_AUTH_SUCCESS",
            company: "${companyName}",
            cif: "${companyCif}",
            expiresAt: "${expiresAt}"
          });
        } catch (e) {
          console.error("BroadcastChannel failed in popup:", e);
        }

        setTimeout(() => {
          let closed = false;
          if (window.opener) {
            try {
              window.opener.postMessage({
                type: "OAUTH_AUTH_SUCCESS",
                company: "${companyName}",
                cif: "${companyCif}",
                expiresAt: "${expiresAt}",
                token: "simulated_token_" + Date.now()
              }, "*");
              window.close();
              closed = true;
            } catch(e) {
              console.error("Failed to postMessage or close:", e);
            }
          }
          
          // Fallback UI if window.opener is null or window.close was blocked
          const statusText = document.querySelector('.text-slate-400');
          if (statusText) {
            statusText.innerHTML = '<span class="text-emerald-600 font-bold block mb-2 text-sm">✓ Datele au fost salvate cu succes!</span><span class="text-slate-500 text-xs">Puteți închide acum manual această fereastră/tab și să reveniți la aplicația 4Friends.</span>';
          }
          const spinner = document.querySelector('.animate-spin');
          if (spinner) {
            spinner.remove();
          }
        }, 2000);
      </script>
    </body>
    </html>
  `);
});

// 4. Gemini AI Intelligent Invoice Mapping Endpoint
app.post("/api/gemini/map-invoice", async (req, res) => {
  try {
    const { items, existingMaterials } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Lipsesc articolele din factură (items array is required)" });
    }
    const safeExistingMaterials = Array.isArray(existingMaterials) ? existingMaterials : [];

    const prompt = `Ești un expert inteligent în contabilitate și achiziții pentru afaceri de catering și mâncare gătită (platouri festive, aperitive, catering) din România.
Tasca ta este să asociezi/mapezi fiecare produs dintr-o factură cu lista noastră curentă de materii prime (ingrediente).

ECUAȚIA DE AUR A MAPPING-ULUI (FLEXIBILITATE TOTALĂ):
Producătorii scriu denumirile produselor în diverse moduri detaliate, prescurtate sau ambalate în facturi, însă pentru noi ele reprezintă o singură materie primă de bază din catalog.
De exemplu:
- "PIEPT PUI CASEROLA DEZOSAT", "PIEPT DE PUI PROASPĂT", "PIEPT DEZOSAT JUMĂTĂȚI", "PIEPT DE PUI FĂRĂ PIELE" -> Se asociază toate la materia primă existentă "piept de pui" sau similar (dacă există)!
- "ROȘII DE GRĂDINĂ CALITATEA I", "ROȘII CAL I SPANIA", "ROSI PROASPETE CASEROLĂ" -> Se asociază la "roșii proaspete".
- "ULEI FLOAREA SOARELUI BUNI 1L", "ULEI FL SOARELUI FLORIO", "ULEI METRO CHEF 5L" -> Se asociază la "ulei floarea soarelui".

LISTA MATERIILOR PRIME EXISTENTE ÎN CATALOGUL NOSTRU:
${JSON.stringify(safeExistingMaterials.map(rm => ({ id: rm.id, name: rm.name, unit: rm.unit })))}

PRODUSELE DIN FACTURA NOUĂ PE CARE TREBUIE SĂ LE MAPEZI:
${JSON.stringify(items.map((it, idx) => ({ index: idx, name: it.name, unitOfMeasure: it.unitOfMeasure })))}

Pentru fiecare produs din factura nouă, analizează dacă reprezintă același ingredient din catalogul nostru existent (folosește potrivire semantică inteligentă):
1. Dacă EXISTĂ un ingredient potrivit în catalog (chiar dacă denumirea din factură este diferită, are detalii de ambalaj sau e scrisă cu prescurtări), setează:
   - "matchType": "existing"
   - "existingMaterialId": ID-ul ingredientului găsit din catalog
   - "suggestedCleanName": Numele exact al ingredientului existent din catalogul nostru
2. Dacă NU există niciun ingredient potrivit în catalog (este un produs/ingredient complet nou, care nu se regăsește deloc sub nicio formă în listă):
   - "matchType": "new"
   - "existingMaterialId": null
   - "suggestedCleanName": Propune o denumire curată, simplă, formatată profesional FĂRĂ DIACRITICE și în MAJUSCULE (ex: transformă "SARE IODATĂ EXTRAFINĂ" în "SARE IODATA", sau "LAPTE GRĂSIME 3.5%" în "LAPTE 3.5%"). Înlătură complet diacriticele (ă->a, â->a, î->i, ș->s, ț->t), detaliile de brand/ambalaj secundare, gramajele și cantitățile, asigurând formatarea exclusivă în litere mari.
   - "unit": Recomandă unitatea de măsură potrivită ("kg", "l", "buc", "pachet" etc.) bazată pe contextul produsului și unitatea de măsură din factură.

Asigură-te că mapezi absolut fiecare element trimis în listă.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Lista de mapări pentru fiecare articol din factură",
          items: {
            type: Type.OBJECT,
            properties: {
              invoiceItemIndex: { type: Type.INTEGER, description: "Indexul articolului din factura nouă (0-based)" },
              matchType: { type: Type.STRING, description: "Valoarea 'existing' sau 'new'" },
              existingMaterialId: { type: Type.STRING, description: "ID-ul materiei prime existente din catalog, sau null dacă e nouă" },
              suggestedCleanName: { type: Type.STRING, description: "Numele curat recomandat (pentru material nou, numele propus simplificat; pentru existent, numele existent)" },
              unit: { type: Type.STRING, description: "Unitatea de măsură recomandată (ex: kg, l, buc)" }
            },
            required: ["invoiceItemIndex", "matchType", "suggestedCleanName", "unit"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Nu s-a putut obține un răspuns de la Gemini");
    }

    const mapping = JSON.parse(text.trim());
    return res.json({ success: true, mapping });
  } catch (error: any) {
    console.error("Eroare la maparea facturii cu Gemini:", error);
    return res.status(500).json({ error: error.message || "Eroare la maparea automată" });
  }
});

// 4b. Parse Recipe PDF Endpoint
app.post("/api/parse-recipe-pdf", async (req, res) => {
  try {
    const { fileBase64 } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: "Fisierul PDF lipseste (fileBase64 is required)" });
    }

    const cleanBase64 = fileBase64.replace(/^data:application\/pdf;base64,/, "");

    const prompt = `Analizează această rețetă / fișă tehnică din documentul PDF încărcat și extrage toate datele structurate în format JSON.
Asigură-te că:
1. Identifici denumirea produsului finit (recipeName / productName). Formatul trebuie să fie exclusiv în MAJUSCULE și FĂRĂ DIACRITICE (ex: "TORT CIOCOLATA").
2. Identifici sau estimezi numărul total de calorii (kcal) per porție sau per unitate de produs finit (calories). Dacă nu sunt menționate clar, estimează-le pe baza ingredientelor principale. Setează ca număr.
3. Identifici lista de alergeni pe care îi conține produsul finit (allergens, ex: ["GLUTEN", "LACTOZA", "OUA", "ARAHIDE"]). Formatează-i în MAJUSCULE și FĂRĂ DIACRITICE.
4. Extrage lista detaliată de ingrediente/materii prime (ingredients):
   - Numele ingredientului (name) - formatat exclusiv în MAJUSCULE și FĂRĂ DIACRITICE (ex: "FAINA DE GRAU", "ZAHAR TOS", "LAPTE 3.5%").
   - Cantitatea necesară (quantityNeeded) - exprimată strict numeric. IMPORTANT: deoarece în rețetă cantitățile sunt introduse în grame (g) și mililitri (ml), păstrează-le ca atare (ex: dacă rețeta cere 250g, pune 250; dacă cere 0.25kg, convertește-l în 250 grame!).
   - Unitatea de măsură standardizată (unit) - folosește 'g' pentru solide/pulberi (grame), 'ml' pentru lichide (mililitri) și 'buc' pentru bucăți/ouă.
   - Note adiționale (notes) - mențiuni sau instrucțiuni specifice despre ingredient.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: cleanBase64
          }
        },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          description: "Datele structurate ale retetei extrase din PDF",
          properties: {
            productName: { type: Type.STRING, description: "Numele rețetei/produsului finit, în majuscule și fără diacritice" },
            calories: { type: Type.NUMBER, description: "Numărul total de calorii (kcal), de preferat per porție sau produs" },
            allergens: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista alergenilor detectați în majuscule și fără diacritice"
            },
            ingredients: {
              type: Type.ARRAY,
              description: "Ingredientele rețetei cu cantitățile convertite la unitățile standard (kg, l, buc)",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Numele ingredientului curat, în majuscule și fără diacritice" },
                  quantityNeeded: { type: Type.NUMBER, description: "Cantitatea necesară exprimată în grame, mililitri sau bucăți" },
                  unit: { type: Type.STRING, description: "Unitatea standard de măsură ('g', 'ml', 'buc')" },
                  notes: { type: Type.STRING, description: "Instrucțiuni sau detalii specifice" }
                },
                required: ["name", "quantityNeeded", "unit"]
              }
            }
          },
          required: ["productName", "ingredients"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Nu s-a putut obține un răspuns de la Gemini pentru rețeta PDF");
    }

    const recipeData = JSON.parse(text.trim());
    return res.json({ success: true, recipe: recipeData });
  } catch (error: any) {
    console.error("Eroare la procesarea retetei PDF cu Gemini:", error);
    return res.status(500).json({ error: error.message || "Eroare la analizarea rețetei PDF" });
  }
});

// 5. ANAF SPV API Sync Endpoint
app.post("/api/anaf/sync", (req, res) => {
  const { cif } = req.body;
  
  // Return realistic mock invoices from our list to trigger price alert recalculation
  const syncMocks = [
    {
      supplierName: "Carmangeria Popescu SRL",
      invoiceNumber: "CP-SPV-" + Math.floor(1000 + Math.random() * 9000),
      invoiceDate: new Date().toISOString().split("T")[0],
      items: [
        { name: "PIEPT PUI CASEROLA DEZOSAT", quantity: 50, unitOfMeasure: "kg", unitPriceBeforeVat: 25.50, vatPercent: 11 }, // Price increase alert
        { name: "CEAFA PORC FARA OS CASEROLA", quantity: 30, unitOfMeasure: "kg", unitPriceBeforeVat: 26.10, vatPercent: 11 }
      ]
    },
    {
      supplierName: "Metro Cash & Carry SRL",
      invoiceNumber: "METRO-SPV-" + Math.floor(1000 + Math.random() * 9000),
      invoiceDate: new Date().toISOString().split("T")[0],
      items: [
        { name: "ROSI PROASPETE CAL. I", quantity: 60, unitOfMeasure: "kg", unitPriceBeforeVat: 8.20, vatPercent: 11 }, // Price increase alert
        { name: "ULEI FLOAREA SOARELUI BUNI 1L", quantity: 45, unitOfMeasure: "l", unitPriceBeforeVat: 5.90, vatPercent: 11 }
      ]
    },
    {
      supplierName: "Ambalaje HoReCa Distrib SRL",
      invoiceNumber: "AHD-SPV-" + Math.floor(1000 + Math.random() * 9000),
      invoiceDate: new Date().toISOString().split("T")[0],
      items: [
        { name: "AMBALAJ PLATOU PLASTIC NEGRU 45CM", quantity: 250, unitOfMeasure: "buc", unitPriceBeforeVat: 3.90, vatPercent: 21 } // Price increase alert
      ]
    }
  ];

  // Randomly pick one
  const randomInvoice = syncMocks[Math.floor(Math.random() * syncMocks.length)];
  
  // Simulate network delay to SPV API
  setTimeout(() => {
    return res.json({
      success: true,
      invoice: randomInvoice
    });
  }, 1200);
});

// Serve Vite dev / Production builds
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
