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
      - procentul TVA (vatPercent, ex: 11 pentru alimente, 21 pentru produse cu zahăr, alcoolice, răcoritoare sau non-alimentare, 19, 9 sau 0)
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
                  vatPercent: { type: Type.NUMBER, description: "Procentul de TVA aplicat (ex: 11, 21, 19, 9, 0)" },
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
