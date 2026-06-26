import React, { useState, useEffect, useRef } from "react";
import {
  Calculator,
  Camera,
  FileText,
  TrendingUp,
  AlertTriangle,
  Percent,
  Truck,
  Scale,
  Plus,
  Trash2,
  Download,
  Upload,
  Calendar,
  Check,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Info,
  ChevronRight,
  Edit,
  X,
  Smartphone,
  Eye,
  CheckSquare
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";

import { RawMaterial, FinalProduct, SaleRecord, PriceAlert, ScannedInvoice, ScannedInvoiceItem, SalePriceBreakdown } from "./types";
import { INITIAL_RAW_MATERIALS, INITIAL_PRODUCTS, INITIAL_SALES } from "./data";
import { calculateSalePrice, formatRON, formatPercent, parseEFacturaXML, exportToCSV } from "./utils";

export default function App() {
  // --- STATE ---
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(() => {
    const saved = localStorage.getItem("raw_materials");
    return saved ? JSON.parse(saved) : INITIAL_RAW_MATERIALS;
  });

  const [products, setProducts] = useState<FinalProduct[]>(() => {
    const saved = localStorage.getItem("final_products");
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [sales, setSales] = useState<SaleRecord[]>(() => {
    const saved = localStorage.getItem("sales_history");
    return saved ? JSON.parse(saved) : INITIAL_SALES;
  });

  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const saved = localStorage.getItem("price_alerts");
    return saved ? JSON.parse(saved) || [] : [];
  });

  // UI state
  const [activeTab, setActiveTab] = useState<"calculator" | "inventory" | "reports">("calculator");
  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    const saved = localStorage.getItem("final_products");
    const parsed = saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    return parsed[0]?.id || "";
  });

  // Form states - Raw Material
  const [newRmName, setNewRmName] = useState("");
  const [newRmUnit, setNewRmUnit] = useState("kg");
  const [newRmPrice, setNewRmPrice] = useState("");
  const [newRmVat, setNewRmVat] = useState("11");
  const [editingRmId, setEditingRmId] = useState<string | null>(null);

  // Form states - Product
  const [showProductForm, setShowProductForm] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdLogistics, setNewProdLogistics] = useState("0");
  const [newProdTaxes, setNewProdTaxes] = useState("0");
  const [newProdMargin, setNewProdMargin] = useState("30");
  const [newProdVat, setNewProdVat] = useState("11");
  const [newProdRecipe, setNewProdRecipe] = useState<{ rawMaterialId: string; quantityNeeded: number }[]>([
    { rawMaterialId: "", quantityNeeded: 0 }
  ]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Sale registering state
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Invoice scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusLog, setScanStatusLog] = useState<string[]>([]);
  const [scannedInvoiceResult, setScannedInvoiceResult] = useState<ScannedInvoice | null>(null);
  const [xmlInputText, setXmlInputText] = useState("");
  const [showXmlInput, setShowXmlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterMonth, setFilterMonth] = useState("All");

  // Alert system check
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem("raw_materials", JSON.stringify(rawMaterials));
  }, [rawMaterials]);

  useEffect(() => {
    localStorage.setItem("final_products", JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem("sales_history", JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem("price_alerts", JSON.stringify(alerts));
  }, [alerts]);

  // --- ACTIONS ---

  const triggerToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // 1. Raw Materials management
  const handleSaveRawMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRmName.trim() || !newRmPrice) {
      triggerToast("Vă rugăm să completați denumirea și prețul de achiziție.", "error");
      return;
    }

    const priceNum = parseFloat(newRmPrice);
    const vatNum = parseFloat(newRmVat);

    if (isNaN(priceNum) || priceNum < 0) {
      triggerToast("Prețul de achiziție trebuie să fie un număr pozitiv.", "error");
      return;
    }

    if (editingRmId) {
      // Update existing
      setRawMaterials(prev =>
        prev.map(rm =>
          rm.id === editingRmId
            ? {
                ...rm,
                name: newRmName.trim(),
                unit: newRmUnit,
                purchasePriceBeforeVat: priceNum,
                vatPercent: vatNum,
                lastUpdated: new Date().toISOString()
              }
            : rm
        )
      );
      triggerToast(`Materia primă "${newRmName}" a fost actualizată!`);
      setEditingRmId(null);
    } else {
      // Create new
      const newRm: RawMaterial = {
        id: `rm-${Date.now()}`,
        name: newRmName.trim(),
        unit: newRmUnit,
        purchasePriceBeforeVat: priceNum,
        vatPercent: vatNum,
        lastUpdated: new Date().toISOString()
      };
      setRawMaterials(prev => [...prev, newRm]);
      triggerToast(`Materia primă "${newRmName}" a fost adăugată cu succes!`);
    }

    // Reset form
    setNewRmName("");
    setNewRmPrice("");
    setNewRmUnit("kg");
    setNewRmVat("11");
  };

  const handleEditRm = (rm: RawMaterial) => {
    setEditingRmId(rm.id);
    setNewRmName(rm.name);
    setNewRmUnit(rm.unit);
    setNewRmPrice(rm.purchasePriceBeforeVat.toString());
    setNewRmVat(rm.vatPercent.toString());
  };

  const handleDeleteRm = (id: string, name: string) => {
    // Check if used in any product recipe
    const isUsed = products.some(p => p.recipeItems.some(item => item.rawMaterialId === id));
    if (isUsed) {
      triggerToast(`Materia primă "${name}" este utilizată într-o rețetă activă și nu poate fi ștearsă!`, "error");
      return;
    }

    if (confirm(`Sigur doriți să ștergeți materia primă "${name}"?`)) {
      setRawMaterials(prev => prev.filter(rm => rm.id !== id));
      setAlerts(prev => prev.filter(al => al.rawMaterialId !== id));
      triggerToast(`Materia primă "${name}" a fost ștearsă.`);
    }
  };

  // 2. Final Product management
  const handleAddRecipeRow = () => {
    setNewProdRecipe([...newProdRecipe, { rawMaterialId: "", quantityNeeded: 0 }]);
  };

  const handleRemoveRecipeRow = (index: number) => {
    const updated = [...newProdRecipe];
    updated.splice(index, 1);
    setNewProdRecipe(updated);
  };

  const handleRecipeRowChange = (index: number, field: "rawMaterialId" | "quantityNeeded", value: any) => {
    const updated = [...newProdRecipe];
    if (field === "quantityNeeded") {
      updated[index].quantityNeeded = parseFloat(value) || 0;
    } else {
      updated[index].rawMaterialId = value;
    }
    setNewProdRecipe(updated);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      triggerToast("Completați denumirea produsului.", "error");
      return;
    }

    // Filter out rows without raw material selected
    const validRecipe = newProdRecipe.filter(item => item.rawMaterialId !== "" && item.quantityNeeded > 0);
    if (validRecipe.length === 0) {
      triggerToast("Vă rugăm să adăugați cel puțin o materie primă validă în rețetă.", "error");
      return;
    }

    const logistics = parseFloat(newProdLogistics) || 0;
    const taxes = parseFloat(newProdTaxes) || 0;
    const margin = parseFloat(newProdMargin) || 0;
    const vat = parseFloat(newProdVat) || 0;

    if (editingProductId) {
      // Update
      setProducts(prev =>
        prev.map(p =>
          p.id === editingProductId
            ? {
                ...p,
                name: newProdName.trim(),
                recipeItems: validRecipe,
                logisticsCost: logistics,
                otherTaxesCost: taxes,
                customMarginPercent: margin,
                customVatPercent: vat
              }
            : p
        )
      );
      triggerToast(`Produsul "${newProdName}" a fost actualizat!`);
      setEditingProductId(null);
    } else {
      // Create new
      const newProduct: FinalProduct = {
        id: `p-${Date.now()}`,
        name: newProdName.trim(),
        recipeItems: validRecipe,
        logisticsCost: logistics,
        otherTaxesCost: taxes,
        customMarginPercent: margin,
        customVatPercent: vat
      };
      setProducts(prev => [...prev, newProduct]);
      setSelectedProductId(newProduct.id);
      triggerToast(`Produsul "${newProdName}" a fost creat cu succes!`);
    }

    // Reset Form
    setShowProductForm(false);
    setNewProdName("");
    setNewProdLogistics("0");
    setNewProdTaxes("0");
    setNewProdMargin("30");
    setNewProdVat("11");
    setNewProdRecipe([{ rawMaterialId: "", quantityNeeded: 0 }]);
  };

  const handleEditProduct = (prod: FinalProduct) => {
    setEditingProductId(prod.id);
    setNewProdName(prod.name);
    setNewProdLogistics(prod.logisticsCost.toString());
    setNewProdTaxes(prod.otherTaxesCost.toString());
    setNewProdMargin(prod.customMarginPercent.toString());
    setNewProdVat(prod.customVatPercent.toString());
    setNewProdRecipe(prod.recipeItems.map(item => ({ ...item })));
    setShowProductForm(true);
  };

  const handleDeleteProduct = (id: string, name: string) => {
    // Check if sales exist
    const hasSales = sales.some(s => s.productId === id);
    if (hasSales) {
      triggerToast(`Produsul "${name}" are vânzări înregistrate și nu poate fi șters din istoric!`, "error");
      return;
    }

    if (confirm(`Sigur doriți să ștergeți produsul "${name}"?`)) {
      setProducts(prev => prev.filter(p => p.id !== id));
      if (selectedProductId === id) {
        setSelectedProductId(products.find(p => p.id !== id)?.id || "");
      }
      triggerToast(`Produsul "${name}" a fost șters.`);
    }
  };

  // 3. Sales Register
  const handleRegisterSale = (e: React.FormEvent) => {
    e.preventDefault();
    const currentProduct = products.find(p => p.id === selectedProductId);
    if (!currentProduct) {
      triggerToast("Nu a fost selectat niciun produs valid.", "error");
      return;
    }

    const qty = parseInt(saleQuantity);
    if (isNaN(qty) || qty <= 0) {
      triggerToast("Cantitatea vândută trebuie să fie un număr pozitiv.", "error");
      return;
    }

    const breakdown = calculateSalePrice(currentProduct, rawMaterials);
    const salePriceBeforeVat = breakdown.salePriceBeforeVat;
    const salePriceWithVat = breakdown.finalSalePriceWithVat;

    const newSale: SaleRecord = {
      id: `s-${Date.now()}`,
      productId: currentProduct.id,
      productName: currentProduct.name,
      quantity: qty,
      salePriceBeforeVat,
      salePriceWithVat,
      totalRevenueBeforeVat: Number((salePriceBeforeVat * qty).toFixed(2)),
      totalRevenueWithVat: Number((salePriceWithVat * qty).toFixed(2)),
      totalCost: Number((breakdown.productionCost * qty).toFixed(2)),
      totalProfit: Number(((salePriceBeforeVat - breakdown.productionCost) * qty).toFixed(2)),
      date: saleDate
    };

    setSales(prev => [newSale, ...prev]);
    triggerToast(`S-a înregistrat vânzarea a ${qty} bucăți din "${currentProduct.name}"!`);
    setSaleQuantity("1");
  };

  const handleDeleteSale = (id: string) => {
    if (confirm("Sigur doriți să ștergeți această vânzare înregistrată?")) {
      setSales(prev => prev.filter(s => s.id !== id));
      triggerToast("Înregistrarea vânzării a fost ștearsă.");
    }
  };

  // 4. Alert Management & Auto-recalculations
  const handleResolveAlert = (alertId: string, applyNewPrice: boolean) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    if (applyNewPrice) {
      // 1. Update the price of the raw material in inventory
      setRawMaterials(prev =>
        prev.map(rm =>
          rm.id === alert.rawMaterialId
            ? {
                ...rm,
                purchasePriceBeforeVat: alert.newPrice,
                lastUpdated: new Date().toISOString()
              }
            : rm
        )
      );
      triggerToast(`Prețul materiei prime "${alert.rawMaterialName}" a fost actualizat la ${formatRON(alert.newPrice)}!`);
    }

    // 2. Mark alert as resolved
    setAlerts(prev => prev.map(al => al.id === alertId ? { ...al, resolved: true } : al));
  };

  const handleResolveAllAlerts = (applyAll: boolean) => {
    const unresolved = alerts.filter(al => !al.resolved);
    if (unresolved.length === 0) return;

    if (applyAll) {
      // Update all raw material prices
      setRawMaterials(prev => {
        let updated = [...prev];
        unresolved.forEach(al => {
          updated = updated.map(rm =>
            rm.id === al.rawMaterialId
              ? { ...rm, purchasePriceBeforeVat: al.newPrice, lastUpdated: new Date().toISOString() }
              : rm
          );
        });
        return updated;
      });
      triggerToast(`Au fost actualizate toate prețurile pentru ${unresolved.length} materii prime!`);
    }

    setAlerts(prev => prev.map(al => ({ ...al, resolved: true })));
    triggerToast("Toate alertele au fost arhivate.");
  };

  // --- XML ANAF E-FACTURA UPLOADER ---
  const handleXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseEFacturaXML(text);

        // Convert parsed raw materials into a structured format
        const scannedInv: ScannedInvoice = {
          id: `inv-${Date.now()}`,
          supplierName: parsed.supplierName,
          invoiceNumber: parsed.invoiceNumber,
          invoiceDate: parsed.invoiceDate,
          items: parsed.items,
          status: "pending"
        };

        setScannedInvoiceResult(scannedInv);
        triggerToast("Factura E-factura XML a fost procesată cu succes!");
        runPriceComparisonEngine(scannedInv);
      } catch (err: any) {
        triggerToast(err.message || "Eroare la procesarea fișierului XML", "error");
      }
    };
    reader.readAsText(file);
  };

  const handlePasteXmlSubmit = () => {
    if (!xmlInputText.trim()) {
      triggerToast("Introduceți textul XML al facturii.", "error");
      return;
    }
    try {
      const parsed = parseEFacturaXML(xmlInputText);
      const scannedInv: ScannedInvoice = {
        id: `inv-${Date.now()}`,
        supplierName: parsed.supplierName,
        invoiceNumber: parsed.invoiceNumber,
        invoiceDate: parsed.invoiceDate,
        items: parsed.items,
        status: "pending"
      };
      setScannedInvoiceResult(scannedInv);
      setShowXmlInput(false);
      setXmlInputText("");
      triggerToast("Factura XML din text a fost procesată!");
      runPriceComparisonEngine(scannedInv);
    } catch (err: any) {
      triggerToast(err.message || "Eroare la procesarea textului XML", "error");
    }
  };

  // --- CAMERA SCANNING (GEMINI SERVER-SIDE API) ---
  const handleCameraPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert file to base64
    setIsScanning(true);
    setScanStatusLog(["Se inițializează camera...", "Imagine preluată cu succes.", "Se încarcă imaginea pe server..."]);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = reader.result as string;
        setScanStatusLog(prev => [...prev, "Se trimite factura către motorul AI Gemini...", "Analiză structură, prețuri și articole..."]);

        const response = await fetch("/api/scan-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64String,
            mimeType: file.type || "image/png"
          })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Eroare la scanarea cu AI.");
        }

        const invoiceData = result.data;
        const scannedInv: ScannedInvoice = {
          id: `inv-${Date.now()}`,
          supplierName: invoiceData.supplierName || "Furnizor Identificat de AI",
          invoiceNumber: invoiceData.invoiceNumber || "F-SCAN-AI",
          invoiceDate: invoiceData.invoiceDate || new Date().toISOString().split("T")[0],
          items: invoiceData.items || [],
          status: "pending"
        };

        setScannedInvoiceResult(scannedInv);
        setScanStatusLog(prev => [...prev, "Procesare AI finalizată!", "Verificare prețuri în curs..."]);
        setTimeout(() => {
          setIsScanning(false);
          setScanStatusLog([]);
          triggerToast("Factura a fost scanată cu camera prin AI Gemini!");
          runPriceComparisonEngine(scannedInv);
        }, 1000);

      } catch (err: any) {
        console.error(err);
        setIsScanning(false);
        setScanStatusLog([]);
        triggerToast(`Eroare AI: ${err.message || "Nu s-a putut analiza imaginea facturii."}`, "error");
      }
    };
    reader.onerror = () => {
      setIsScanning(false);
      triggerToast("Eroare la citirea fișierului de imagine.", "error");
    };
    reader.readAsDataURL(file);
  };

  // --- ANAF SPV SIMULATOR ---
  const handleSimulateSPV = (supplierIndex: number) => {
    setIsScanning(true);
    setScanStatusLog([
      "Se conectează la serverul ANAF SPV cu certificat digital...",
      "Autentificare reușită pentru CIF: RO123456789",
      "Se caută facturi noi emise de furnizori în E-Factura...",
      "Factură nouă identificată!"
    ]);

    // Simple mock invoices to demonstrate realistic price alerts!
    const mocks = [
      {
        supplierName: "Moara Tradițională Românească SRL",
        invoiceNumber: "MR-9801",
        invoiceDate: new Date().toISOString().split("T")[0],
        items: [
          { name: "Făină superioară tip 000", quantity: 500, unitOfMeasure: "kg", unitPriceBeforeVat: 5.15, vatPercent: 9 }, // Increased from 4.50
          { name: "Zahăr tos", quantity: 200, unitOfMeasure: "kg", unitPriceBeforeVat: 5.20, vatPercent: 9 } // Unchanged
        ]
      },
      {
        supplierName: "Dinu Distrib Lactate SA",
        invoiceNumber: "DDL-4412",
        invoiceDate: new Date().toISOString().split("T")[0],
        items: [
          { name: "Unt românesc 82% grăsime", quantity: 60, unitOfMeasure: "kg", unitPriceBeforeVat: 46.50, vatPercent: 9 }, // Increased from 42.00
          { name: "Lapte proaspăt 3.5% grăsime", quantity: 150, unitOfMeasure: "l", unitPriceBeforeVat: 6.10, vatPercent: 9 } // Decreased from 6.50
        ]
      },
      {
        supplierName: "Ambalaje Eco Industrial SA",
        invoiceNumber: "AEI-0029",
        invoiceDate: new Date().toISOString().split("T")[0],
        items: [
          { name: "Ambalaj cutie biodegradabilă premium", quantity: 1000, unitOfMeasure: "buc", unitPriceBeforeVat: 2.95, vatPercent: 19 } // Increased from 2.50
        ]
      }
    ];

    setTimeout(() => {
      setScanStatusLog(prev => [...prev, "Se descarcă XML-ul oficial ANAF (UBL standard)...", "Se convertește factura în format intern..."]);
      setTimeout(() => {
        const selectedMock = mocks[supplierIndex];
        const scannedInv: ScannedInvoice = {
          id: `inv-spv-${Date.now()}`,
          supplierName: selectedMock.supplierName,
          invoiceNumber: selectedMock.invoiceNumber,
          invoiceDate: selectedMock.invoiceDate,
          items: selectedMock.items,
          status: "pending"
        };

        setScannedInvoiceResult(scannedInv);
        setIsScanning(false);
        setScanStatusLog([]);
        triggerToast(`Factura ${selectedMock.invoiceNumber} a fost descărcată din SPV ANAF!`);
        runPriceComparisonEngine(scannedInv);
      }, 1500);
    }, 1500);
  };

  // --- AUTOMATIC PRICE ALERT ENGINE ---
  const runPriceComparisonEngine = (invoice: ScannedInvoice) => {
    const newAlerts: PriceAlert[] = [];

    invoice.items.forEach((item) => {
      // Find matching raw material by name (case insensitive matching or substring)
      const matchingRm = rawMaterials.find(
        rm =>
          rm.name.toLowerCase().includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().includes(rm.name.toLowerCase())
      );

      if (matchingRm) {
        const oldPrice = matchingRm.purchasePriceBeforeVat;
        const newPrice = item.unitPriceBeforeVat;

        // Check if price is different (allowing a tiny threshold for float precision)
        if (Math.abs(oldPrice - newPrice) > 0.01) {
          const type = newPrice > oldPrice ? "price_increase" : "price_decrease";

          const alert: PriceAlert = {
            id: `alert-${Date.now()}-${matchingRm.id}`,
            type,
            rawMaterialId: matchingRm.id,
            rawMaterialName: matchingRm.name,
            oldPrice,
            newPrice,
            invoiceNumber: invoice.invoiceNumber,
            supplierName: invoice.supplierName,
            date: invoice.invoiceDate,
            resolved: false
          };

          newAlerts.push(alert);
        }
      }
    });

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev]);
      triggerToast(`Atenție! Au fost detectate ${newAlerts.length} diferențe de preț în noua factură. Alertele sunt afișate la monitor!`, "info");
    } else {
      triggerToast("Verificarea a fost finalizată. Toate prețurile din factură sunt în concordanță cu cele din baza de date!", "success");
    }
  };

  // --- REPORTS CALCULATIONS ---
  // Get filtered sales
  const getFilteredSales = () => {
    if (filterMonth === "All") return sales;
    return sales.filter(s => {
      // s.date format: YYYY-MM-DD
      const dateParts = s.date.split("-");
      if (dateParts.length < 2) return false;
      const yearMonth = `${dateParts[0]}-${dateParts[1]}`; // e.g. "2026-06"
      return yearMonth === filterMonth;
    });
  };

  const filteredSalesList = getFilteredSales();

  // Get month options from sales dates
  const getMonthOptions = () => {
    const months = new Set<string>();
    sales.forEach(s => {
      const dateParts = s.date.split("-");
      if (dateParts.length >= 2) {
        months.add(`${dateParts[0]}-${dateParts[1]}`);
      }
    });
    return Array.from(months).sort().reverse(); // e.g., ["2026-06", "2026-05", "2026-04"]
  };

  const monthOptions = getMonthOptions();

  // Calculate stats for filtered period
  const calculatePeriodStats = () => {
    let totalRevenueBeforeVat = 0;
    let totalRevenueWithVat = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let itemsCount = 0;

    filteredSalesList.forEach(s => {
      totalRevenueBeforeVat += s.totalRevenueBeforeVat;
      totalRevenueWithVat += s.totalRevenueWithVat;
      totalCost += s.totalCost;
      totalProfit += s.totalProfit;
      itemsCount += s.quantity;
    });

    const averageMargin = totalRevenueBeforeVat > 0 ? (totalProfit / totalRevenueBeforeVat) * 100 : 0;

    return {
      totalRevenueBeforeVat,
      totalRevenueWithVat,
      totalCost,
      totalProfit,
      itemsCount,
      averageMargin
    };
  };

  const periodStats = calculatePeriodStats();

  // Recharts Monthly Evolution Data
  const getMonthlyChartData = () => {
    // Group sales by month
    const groups: { [key: string]: { revenue: number; cost: number; profit: number } } = {};

    sales.forEach(s => {
      const dateParts = s.date.split("-");
      if (dateParts.length >= 2) {
        const monthKey = `${dateParts[0]}-${dateParts[1]}`;
        if (!groups[monthKey]) {
          groups[monthKey] = { revenue: 0, cost: 0, profit: 0 };
        }
        groups[monthKey].revenue += s.totalRevenueBeforeVat;
        groups[monthKey].cost += s.totalCost;
        groups[monthKey].profit += s.totalProfit;
      }
    });

    // Translate keys like "2026-06" into "Iun 2026"
    const monthNamesRo: { [key: string]: string } = {
      "01": "Ian", "02": "Feb", "03": "Mar", "04": "Apr", "05": "Mai", "06": "Iun",
      "07": "Iul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Noi", "12": "Dec"
    };

    return Object.keys(groups)
      .sort()
      .map(key => {
        const parts = key.split("-");
        const name = `${monthNamesRo[parts[1]] || parts[1]} ${parts[0]}`;
        return {
          monthCode: key,
          Nume: name,
          "Venituri (fara TVA)": Number(groups[key].revenue.toFixed(2)),
          "Costuri Productie": Number(groups[key].cost.toFixed(2)),
          "Profit Brut": Number(groups[key].profit.toFixed(2))
        };
      });
  };

  const monthlyChartData = getMonthlyChartData();

  // Recharts Product Profitability Data
  const getProductChartData = () => {
    const groups: { [key: string]: { name: string; revenue: number; profit: number } } = {};

    filteredSalesList.forEach(s => {
      if (!groups[s.productId]) {
        groups[s.productId] = { name: s.productName, revenue: 0, profit: 0 };
      }
      groups[s.productId].revenue += s.totalRevenueBeforeVat;
      groups[s.productId].profit += s.totalProfit;
    });

    return Object.values(groups).map(g => ({
      name: g.name.substring(0, 20) + (g.name.length > 20 ? "..." : ""),
      "Venit total": Number(g.revenue.toFixed(2)),
      "Profit total": Number(g.profit.toFixed(2))
    }));
  };

  const productChartData = getProductChartData();

  // --- EXPORT FUNCTIONALITY ---
  const handleExportCSV = () => {
    const headers = [
      "ID Vanzare",
      "Produs",
      "Data",
      "Cantitate",
      "Pret unitar fara TVA",
      "Pret unitar cu TVA",
      "Venit fara TVA (RON)",
      "Venit cu TVA (RON)",
      "Cost fabricatie (RON)",
      "Profit (RON)"
    ];

    const rows = filteredSalesList.map(s => [
      s.id,
      s.productName,
      s.date,
      s.quantity,
      s.salePriceBeforeVat,
      s.salePriceWithVat,
      s.totalRevenueBeforeVat,
      s.totalRevenueWithVat,
      s.totalCost,
      s.totalProfit
    ]);

    const filename = `Raport_Profitabilitate_${filterMonth === "All" ? "Total" : filterMonth}.csv`;
    exportToCSV(filename, headers, rows);
    triggerToast("Fișierul CSV a fost descărcat cu succes!");
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // Active product price calculator
  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];
  const activeProductBreakdown = activeProduct ? calculateSalePrice(activeProduct, rawMaterials) : null;

  const activeAlerts = alerts.filter(al => !al.resolved);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-slate-700 animate-slide-up max-w-md no-print">
          {toastMessage.type === "success" && <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />}
          {toastMessage.type === "error" && <div className="w-2.5 h-2.5 bg-rose-400 rounded-full" />}
          {toastMessage.type === "info" && <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full" />}
          <p className="text-sm font-medium">{toastMessage.text}</p>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 no-print border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">4</div>
            <span className="text-xl font-semibold tracking-tight text-white">4Friends Margin</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab("calculator")}
            className={`flex items-center gap-3 p-3 w-full text-left rounded-xl transition-colors whitespace-nowrap ${
              activeTab === "calculator"
                ? "bg-slate-800 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:bg-slate-800/55 hover:text-white"
            }`}
          >
            <Calculator className="w-5 h-5 text-indigo-400" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center gap-3 p-3 w-full text-left rounded-xl transition-colors whitespace-nowrap relative ${
              activeTab === "inventory"
                ? "bg-slate-800 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:bg-slate-800/55 hover:text-white"
            }`}
          >
            <Camera className="w-5 h-5 text-indigo-400" />
            <span>Scanare OCR / SPV</span>
            {activeAlerts.length > 0 && (
              <span className="absolute right-3 top-3.5 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-slate-900">
                {activeAlerts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-3 p-3 w-full text-left rounded-xl transition-colors whitespace-nowrap ${
              activeTab === "reports"
                ? "bg-slate-800 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:bg-slate-800/55 hover:text-white"
            }`}
          >
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <span>Rapoarte Profit</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800 shrink-0 hidden md:block">
          <div className="bg-slate-800/50 p-4 rounded-xl">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2 font-bold">Status Conexiune</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-slate-300 font-medium">SPV E-Factura Activ</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0">
        
        {/* Header */}
        <header className="h-auto md:h-16 bg-white border-b border-slate-200 flex flex-col md:flex-row items-center justify-between px-8 py-4 md:py-0 shrink-0 gap-3 no-print shadow-xs">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              {activeTab === "calculator" && "Analiză Profitabilitate Rețete"}
              {activeTab === "inventory" && "Catalog Materii Prime & Monitorizare Furnizori"}
              {activeTab === "reports" && `Performanță Profitabilitate ${filterMonth === "All" ? "Totală" : filterMonth}`}
            </h2>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {activeTab === "reports" && (
              <>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Export CSV
                </button>
                <button
                  onClick={handlePrintPDF}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all cursor-pointer"
                >
                  Export PDF
                </button>
              </>
            )}
          </div>
        </header>

        {/* ACTIVE PRICE ALERTS BANNER BAR */}
        {activeAlerts.length > 0 && (
          <div className="bg-rose-50 border-b border-rose-200 py-3 px-8 no-print animate-fade-in shrink-0">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="bg-rose-500 text-white p-1.5 rounded-lg shrink-0">
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-bold text-rose-950 text-sm">
                    Alerte Modificare Preț Furnizori ({activeAlerts.length})
                  </h4>
                  <p className="text-xs text-rose-800 font-medium">
                    Au fost detectate diferențe între prețurile din facturile noi și prețurile stabilite în sistem. Aprobați modificările pentru a actualiza automat rețetele și a proteja profitabilitatea!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveTab("inventory")}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  Vezi Alertele <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleResolveAllAlerts(true)}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-950 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  Aprobă Toate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Container for Main Content */}
        <div className="p-8 space-y-6 flex-1 overflow-y-auto">

          {/* PRINT-ONLY HEADER */}
          <div className="hidden print-only max-w-4xl mx-auto p-6 bg-white border-b-2 border-slate-900 mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Raport de Profitabilitate Lunară</h1>
                <p className="text-sm text-slate-600">Generat automat de Calculator Profitabilitate & Smart Margin</p>
              </div>
              <div className="text-right">
                <h3 className="font-bold">Perioada Analizată: {filterMonth === "All" ? "Toate Vânzările" : filterMonth}</h3>
                <p className="text-sm text-slate-600">Data: {new Date().toLocaleDateString("ro-RO")}</p>
              </div>
            </div>
          </div>

        {/* --- GENERAL STATS DASHBOARD BAR --- */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6 no-print">
          
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Venituri Totale</span>
              <div className="bg-emerald-50 text-emerald-700 p-1.5 rounded-lg">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-lg font-bold font-mono tracking-tight text-slate-900">
                {formatRON(periodStats.totalRevenueWithVat)}
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                {formatRON(periodStats.totalRevenueBeforeVat)} fără TVA
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Cost Fabricat</span>
              <div className="bg-slate-50 text-slate-600 p-1.5 rounded-lg">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-lg font-bold font-mono tracking-tight text-slate-900">
                {formatRON(periodStats.totalCost)}
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                Materii prime, regie și logistică
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Profit Brut</span>
              <div className="bg-emerald-500 text-white p-1.5 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-lg font-bold font-mono tracking-tight text-emerald-600">
                {formatRON(periodStats.totalProfit)}
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                Marjă medie: {periodStats.averageMargin.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Alerte Preț</span>
              <div className={`${activeAlerts.length > 0 ? "bg-rose-500 text-white animate-pulse" : "bg-slate-50 text-slate-400"} p-1.5 rounded-lg`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className={`text-lg font-bold font-mono tracking-tight ${activeAlerts.length > 0 ? "text-rose-600" : "text-slate-900"}`}>
                {activeAlerts.length} Active
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                Diferențe facturi vs. stoc
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Produse & Retete</span>
              <div className="bg-slate-50 text-slate-600 p-1.5 rounded-lg">
                <Calculator className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-lg font-bold font-mono tracking-tight text-slate-900">
                {products.length} Rețete
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                {rawMaterials.length} Materii prime active
              </p>
            </div>
          </div>

        </section>

        {/* ========================================================= */}
        {/* TAB 1: PRODUCT CALCULATOR (TABEL PRODUSE, FORMULA SI GRAFIC) */}
        {/* ========================================================= */}
        {activeTab === "calculator" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
            
            {/* Products side panel list (col-span-5) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Produse Finale & Rețete</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Selectați un produs pentru a-i vedea formula</p>
                </div>
                <button
                  onClick={() => {
                    setEditingProductId(null);
                    setNewProdName("");
                    setNewProdLogistics("0");
                    setNewProdTaxes("0");
                    setNewProdMargin("30");
                    setNewProdVat("11");
                    setNewProdRecipe([{ rawMaterialId: "", quantityNeeded: 0 }]);
                    setShowProductForm(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md shadow-indigo-200 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adaugă Produs
                </button>
              </div>

              {/* Product creator modal / inline form */}
              {showProductForm && (
                <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-indigo-600" />
                      {editingProductId ? "Editează Produs / Rețetă" : "Creează Produs Nou & Rețetă"}
                    </h4>
                    <button
                      onClick={() => setShowProductForm(false)}
                      className="text-indigo-800 hover:text-indigo-950 p-0.5 rounded-lg hover:bg-indigo-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveProduct} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Nume Produs</label>
                      <input
                        type="text"
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        placeholder="Ex: Cozonac Traditional, Tort Diplomat"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-indigo-600"
                        required
                      />
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">Ingrediente rețetă</span>
                        <button
                          type="button"
                          onClick={handleAddRecipeRow}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" /> Adaugă materie primă
                        </button>
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {newProdRecipe.map((recipeItem, index) => (
                          <div key={index} className="flex items-center gap-1.5">
                            <select
                              value={recipeItem.rawMaterialId}
                              onChange={(e) => handleRecipeRowChange(index, "rawMaterialId", e.target.value)}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-md p-1 text-[11px] font-medium focus:outline-indigo-600"
                              required
                            >
                              <option value="">Alege ingredient...</option>
                              {rawMaterials.map((rm) => (
                                <option key={rm.id} value={rm.id}>
                                  {rm.name} ({formatRON(rm.purchasePriceBeforeVat)}/{rm.unit})
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="any"
                              value={recipeItem.quantityNeeded || ""}
                              onChange={(e) => handleRecipeRowChange(index, "quantityNeeded", e.target.value)}
                              placeholder="Cant."
                              className="w-16 bg-slate-50 border border-slate-200 rounded-md p-1 text-[11px] font-mono text-right focus:outline-indigo-600"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipeRow(index)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              disabled={newProdRecipe.length === 1}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-0.5" title="Include transport, ambalaje și utilități (curent, apă, gaze, gunoi)">
                          <Truck className="w-3 h-3 text-slate-400" /> Logist. & Utilități (RON)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newProdLogistics}
                          onChange={(e) => setNewProdLogistics(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono text-right focus:outline-indigo-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-0.5" title="Alte taxe locale și costuri administrative indirecte">
                          <Scale className="w-3 h-3 text-slate-400" /> Alte Taxe & Regie (RON)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newProdTaxes}
                          onChange={(e) => setNewProdTaxes(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono text-right focus:outline-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-0.5">
                          <Percent className="w-3 h-3 text-indigo-600" /> Marjă profit (%)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={newProdMargin}
                          onChange={(e) => setNewProdMargin(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono text-right focus:outline-indigo-600"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                          TVA Vânzare (%)
                        </label>
                        <select
                          value={newProdVat}
                          onChange={(e) => setNewProdVat(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-medium focus:outline-indigo-600"
                        >
                          <option value="11">11% (Produse Alimentare)</option>
                          <option value="21">21% (Zahăr, Alcool, Răcoritoare, Non-alimente)</option>
                          <option value="19">19% (Standard/Ambalaje)</option>
                          <option value="9">9% (Vechi Alimente)</option>
                          <option value="0">0% (Scutit)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setShowProductForm(false)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                      >
                        Anulează
                      </button>
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Salvează Rețetă
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Product List */}
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1 max-h-[500px]">
                {products.length === 0 ? (
                  <div className="p-8 text-center">
                    <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-500">Nu aveți produse adăugate.</p>
                    <p className="text-xs text-slate-400">Adăugați rețeta unui produs final pentru a începe calculele.</p>
                  </div>
                ) : (
                  products.map((prod) => {
                    const activeBreakdown = calculateSalePrice(prod, rawMaterials);
                    const isSelected = selectedProductId === prod.id;

                    return (
                      <div
                        key={prod.id}
                        onClick={() => setSelectedProductId(prod.id)}
                        className={`p-4 transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected ? "bg-indigo-50/70 border-l-4 border-indigo-600" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{prod.name}</h4>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-medium">
                            <span>{prod.recipeItems.length} ingrediente</span>
                            <span>•</span>
                            <span>TVA {prod.customVatPercent}%</span>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div>
                            <span className="block font-bold font-mono text-xs sm:text-sm text-slate-900">
                              {formatRON(activeBreakdown.finalSalePriceWithVat)}
                            </span>
                            <span className="block text-[9px] text-indigo-600 font-bold uppercase tracking-wide">
                              M: {prod.customMarginPercent}%
                            </span>
                          </div>
                          
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProduct(prod);
                              }}
                              className="p-1 hover:bg-slate-200 rounded-md text-slate-600 cursor-pointer"
                              title="Editează rețetă"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(prod.id, prod.name);
                              }}
                              className="p-1 hover:bg-slate-200 rounded-md text-rose-500 cursor-pointer"
                              title="Șterge rețetă"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Product Pricing Details Panel (col-span-7) */}
            <div className="lg:col-span-7 space-y-6">
              
              {activeProduct && activeProductBreakdown ? (
                <>
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 mb-5">
                      <div>
                        <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full">
                          Calcul Preț de Vânzare
                        </span>
                        <h2 className="font-extrabold text-slate-900 text-lg mt-1">{activeProduct.name}</h2>
                      </div>
                      
                      {/* Quick sale button */}
                      <form onSubmit={handleRegisterSale} className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Înregistrare Vânzare:</span>
                        <input
                          type="number"
                          min="1"
                          value={saleQuantity}
                          onChange={(e) => setSaleQuantity(e.target.value)}
                          className="w-12 bg-white border border-slate-200 rounded-md px-1.5 py-1 text-xs font-mono text-center focus:outline-indigo-600"
                          required
                        />
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md shadow-indigo-200 transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Vinde
                        </button>
                      </form>
                    </div>

                    {/* Pricing Breakdown Cards Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Materii Prime</span>
                        <p className="font-mono font-bold text-slate-900 text-sm mt-1">
                          {formatRON(activeProductBreakdown.totalRawMaterialCost)}
                        </p>
                        <span className="text-[9px] text-slate-400 font-medium">Cost cumulat ingrediente</span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Logistică & Utilități</span>
                        <p className="font-mono font-bold text-slate-900 text-sm mt-1">
                          {formatRON(activeProductBreakdown.logisticsCost)}
                        </p>
                        <span className="text-[9px] text-slate-400 font-medium">Utilități (curent, apă, gaz, gunoi) + ambalaje</span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Alte Taxe & Regie</span>
                        <p className="font-mono font-bold text-slate-900 text-sm mt-1">
                          {formatRON(activeProductBreakdown.otherTaxes)}
                        </p>
                        <span className="text-[9px] text-slate-400 font-medium">Taxe locale și alte regii administrative</span>
                      </div>

                      <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Marjă Profit</span>
                        <p className="font-mono font-bold text-indigo-700 text-sm mt-1">
                          {formatRON(activeProductBreakdown.profitMarginAmount)}
                        </p>
                        <span className="text-[9px] text-indigo-600 font-bold">
                          Marjă aplicată: +{activeProduct.customMarginPercent}%
                        </span>
                      </div>

                    </div>

                    {/* Step-by-Step Sale Price Building Visual Chart */}
                    <div className="space-y-4 mb-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <h4 className="font-bold text-xs text-slate-600 uppercase tracking-wider mb-2">
                        Grafic Formare Preț Final de Vânzare (RON)
                      </h4>

                      {/* Cumulative bars visualization */}
                      <div className="space-y-3">
                        
                        {/* 1. Production Cost component */}
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="font-semibold text-slate-600">Cost de Producție (Materii Prime + Logistică & Utilități + Alte Taxe)</span>
                            <span className="font-mono font-bold text-slate-900">
                              {formatRON(activeProductBreakdown.productionCost)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${(activeProductBreakdown.totalRawMaterialCost / activeProductBreakdown.finalSalePriceWithVat) * 100}%` }}
                              className="bg-indigo-300 h-full"
                              title="Cost Ingredient"
                            />
                            <div
                              style={{ width: `${(activeProductBreakdown.logisticsCost / activeProductBreakdown.finalSalePriceWithVat) * 100}%` }}
                              className="bg-indigo-500 h-full"
                              title="Cost Logistică & Utilități"
                            />
                            <div
                              style={{ width: `${(activeProductBreakdown.otherTaxes / activeProductBreakdown.finalSalePriceWithVat) * 100}%` }}
                              className="bg-slate-400 h-full"
                              title="Alte Taxe & Regie"
                            />
                          </div>
                        </div>

                        {/* 2. Sale Price Before VAT */}
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="font-semibold text-slate-600">Preț Vânzare fără TVA (Cost + Marjă profit)</span>
                            <span className="font-mono font-bold text-slate-900">
                              {formatRON(activeProductBreakdown.salePriceBeforeVat)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${(activeProductBreakdown.productionCost / activeProductBreakdown.salePriceBeforeVat) * 100}%` }}
                              className="bg-slate-700 h-full"
                            />
                            <div
                              style={{ width: `${(activeProductBreakdown.profitMarginAmount / activeProductBreakdown.salePriceBeforeVat) * 100}%` }}
                              className="bg-indigo-400 h-full"
                            />
                          </div>
                        </div>

                        {/* 3. Final Selling Price with VAT */}
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="font-bold text-indigo-950">Preț Final de Vânzare cu TVA ({activeProduct.customVatPercent}%)</span>
                            <span className="font-mono font-extrabold text-indigo-700 text-sm">
                              {formatRON(activeProductBreakdown.finalSalePriceWithVat)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex ring-1 ring-indigo-300">
                            <div
                              style={{ width: `${(activeProductBreakdown.salePriceBeforeVat / activeProductBreakdown.finalSalePriceWithVat) * 100}%` }}
                              className="bg-indigo-600 h-full"
                            />
                            <div
                              style={{ width: `${(activeProductBreakdown.vatAmount / activeProductBreakdown.finalSalePriceWithVat) * 100}%` }}
                              className="bg-amber-400 h-full"
                            />
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-500 font-medium mt-1">
                            <span>Preț fără TVA: {formatRON(activeProductBreakdown.salePriceBeforeVat)}</span>
                            <span>Valoare TVA încasat: {formatRON(activeProductBreakdown.vatAmount)}</span>
                          </div>
                        </div>

                      </div>

                    </div>

                    {/* Recipe item detailed breakdown table */}
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 p-3 border-b border-slate-100">
                        <h4 className="font-bold text-xs text-slate-700">Compoziție Detaliată Rețetă & Costuri Ingrediente</h4>
                      </div>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100/50 border-b border-slate-100 font-bold text-slate-600">
                            <th className="p-2.5">Materie Primă</th>
                            <th className="p-2.5 text-right">Preț Unitar Achiziție</th>
                            <th className="p-2.5 text-right">Cantitate Necesară</th>
                            <th className="p-2.5 text-right">Cost Total Ingredient</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeProduct.recipeItems.map((item, index) => {
                            const rm = rawMaterials.find((r) => r.id === item.rawMaterialId);
                            if (!rm) return null;
                            const totalCost = item.quantityNeeded * rm.purchasePriceBeforeVat;

                            return (
                              <tr key={index} className="hover:bg-slate-50/50">
                                <td className="p-2.5 font-semibold text-slate-900">{rm.name}</td>
                                <td className="p-2.5 font-mono text-right text-slate-500">
                                  {formatRON(rm.purchasePriceBeforeVat)} / {rm.unit}
                                </td>
                                <td className="p-2.5 font-mono text-right text-slate-900 font-medium">
                                  {item.quantityNeeded} {rm.unit}
                                </td>
                                <td className="p-2.5 font-mono text-right font-semibold text-slate-900">
                                  {formatRON(totalCost)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-bold border-t border-slate-200">
                            <td colSpan={3} className="p-2.5 text-right text-slate-600">Total Cost Materii Prime:</td>
                            <td className="p-2.5 font-mono text-right text-slate-950 text-xs sm:text-sm">
                              {formatRON(activeProductBreakdown.totalRawMaterialCost)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                  </div>

                  <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200 flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-950 text-xs">Ajustări în timp real:</h4>
                      <p className="text-[11px] text-amber-950/80 leading-relaxed mt-0.5">
                        Dacă prețul de achiziție al oricărui ingredient din tabelul de mai sus se modifică pe facturile viitoare (prin scanare sau SPV), aplicația vă va avertiza instantaneu. Prețul de producție și prețul final de vânzare vor fi recalculate imediat pentru a vă păstra neatinsă marja de profit dorită de <strong>{activeProduct.customMarginPercent}%</strong>.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs">
                  <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-800">Niciun Produs Selectat</h3>
                  <p className="text-xs text-slate-500 mt-1">Creați sau alegeți un produs din lista stângă pentru calcule.</p>
                </div>
              )}

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: INVENTORY, CAMERA INVOICE SCANNING, SPV XML & ALERTS */}
        {/* ========================================================= */}
        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
            
            {/* Raw materials inventory list (col-span-5) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Catalog Materii Prime</h3>
                <p className="text-[11px] text-slate-500 font-medium">Prețurile curente stabilite în rețete</p>
              </div>

              {/* Add / Edit Raw Material Form */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/30">
                <form onSubmit={handleSaveRawMaterial} className="space-y-3">
                  <h4 className="font-bold text-xs text-slate-700 uppercase flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    {editingRmId ? "Editează Materie Primă" : "Adaugă Materie Primă Manual"}
                  </h4>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Denumire</label>
                      <input
                        type="text"
                        value={newRmName}
                        onChange={(e) => setNewRmName(e.target.value)}
                        placeholder="Ex: Făină tip 000, Ouă"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-medium focus:outline-indigo-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">U.M.</label>
                      <select
                        value={newRmUnit}
                        onChange={(e) => setNewRmUnit(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-medium focus:outline-indigo-600"
                      >
                        <option value="kg">kg</option>
                        <option value="l">litru</option>
                        <option value="buc">buc</option>
                        <option value="m">metru</option>
                        <option value="g">gram</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Preț Achiziție (Fără TVA)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={newRmPrice}
                        onChange={(e) => setNewRmPrice(e.target.value)}
                        placeholder="0.00 RON"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono text-right focus:outline-indigo-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Procent TVA (%)</label>
                      <select
                        value={newRmVat}
                        onChange={(e) => setNewRmVat(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-medium focus:outline-indigo-600"
                      >
                        <option value="11">11% (Alimente)</option>
                        <option value="21">21% (Zahăr, Alcool, Răcoritoare, Non-alimente)</option>
                        <option value="19">19% (Standard/Ambalaje)</option>
                        <option value="9">9% (Vechi Alimente)</option>
                        <option value="0">0% (Scutit)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    {editingRmId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRmId(null);
                          setNewRmName("");
                          setNewRmPrice("");
                          setNewRmUnit("kg");
                          setNewRmVat("11");
                        }}
                        className="bg-slate-200 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-slate-300 transition-all cursor-pointer"
                      >
                        Anulează
                      </button>
                    )}
                    <button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold px-4 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 text-indigo-400" />
                      {editingRmId ? "Actualizează" : "Salvează în Catalog"}
                    </button>
                  </div>

                </form>
              </div>

              {/* Inventory Table List */}
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1 max-h-[450px]">
                {rawMaterials.map((rm) => (
                  <div key={rm.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between group">
                    <div className="min-w-0 pr-2">
                      <h4 className="font-semibold text-slate-900 text-xs sm:text-sm truncate">{rm.name}</h4>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                        Actualizat la: {new Date(rm.lastUpdated).toLocaleDateString("ro-RO")} • TVA {rm.vatPercent}%
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <span className="block font-mono font-bold text-xs sm:text-sm text-slate-900">
                          {formatRON(rm.purchasePriceBeforeVat)} / {rm.unit}
                        </span>
                        <span className="block text-[9px] text-slate-400 font-semibold">
                          {formatRON(rm.purchasePriceBeforeVat * (1 + rm.vatPercent / 100))} cu TVA
                        </span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => handleEditRm(rm)}
                          className="p-1 hover:bg-slate-100 rounded-md text-slate-600"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRm(rm.id, rm.name)}
                          className="p-1 hover:bg-slate-100 rounded-md text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Smart Invoice Scanner, ANAF XML & Price Alerts System (col-span-7) */}
            <div className="lg:col-span-7 space-y-6">

              {/* Price alerts panel if unresolved alerts exist */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-rose-500 text-white p-1.5 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        Centru de Alertă Prețuri Materiale
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">Detectate automat din scanări sau SPV</p>
                    </div>
                  </div>
                  {activeAlerts.length > 0 && (
                    <button
                      onClick={() => handleResolveAllAlerts(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700"
                    >
                      Arhivează-le fără modificări
                    </button>
                  )}
                </div>

                {activeAlerts.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100/70">
                    <CheckSquare className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Nu aveți alerte de preț active!</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      Scanați facturi fizice cu camera telefonului sau încărcați fișierele XML descărcate din ANAF E-factura SPV pentru a verifica instantaneu dacă prețurile s-au modificat.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeAlerts.map((alert) => {
                      const percentDiff = ((alert.newPrice - alert.oldPrice) / alert.oldPrice) * 100;
                      const isIncrease = alert.type === "price_increase";

                      return (
                        <div
                          key={alert.id}
                          className={`p-3 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fade-in ${
                            isIncrease
                              ? "bg-rose-50/50 border-rose-200"
                              : "bg-amber-50/50 border-amber-200"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                                  isIncrease ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {isIncrease ? "Majorare Preț" : "Ieftinire"}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                Factura: #{alert.invoiceNumber}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 text-sm mt-1">{alert.rawMaterialName}</h4>
                            <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                              Furnizor: <strong className="text-slate-800">{alert.supplierName}</strong>
                            </p>
                            <div className="flex items-center gap-3 mt-1.5 font-mono text-[11px]">
                              <span className="text-slate-500">De la: {formatRON(alert.oldPrice)}</span>
                              <span className="text-slate-400">→</span>
                              <span className="font-bold text-slate-900">Nou: {formatRON(alert.newPrice)}</span>
                              <span className={`font-bold ${isIncrease ? "text-rose-600" : "text-emerald-600"}`}>
                                ({isIncrease ? "+" : ""}{percentDiff.toFixed(1)}%)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end md:self-center">
                            <button
                              onClick={() => handleResolveAlert(alert.id, false)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                              title="Păstrează prețul din catalog neatins"
                            >
                              Ignoră
                            </button>
                            <button
                              onClick={() => handleResolveAlert(alert.id, true)}
                              className={`text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer text-white ${
                                isIncrease ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                              }`}
                              title="Actualizează prețul în sistem și recalculează automat toate rețetele"
                            >
                              Aplică & Recalculează
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* INVOICE SCANNING & UPLOADING ENGINE CARD */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                
                <div className="border-b border-slate-100 pb-4 mb-5">
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full">
                    Motor Scanare Facturi
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-base mt-1">
                    Introduceți facturile automat în sistem
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Utilizați camera telefonului, uploadați imagini sau importați XML direct din ANAF SPV E-factura.
                  </p>
                </div>

                {/* Processing/Loading Logs Box */}
                {isScanning && (
                  <div className="bg-slate-950 text-indigo-400 font-mono p-4 rounded-xl border border-slate-800 mb-6 text-xs space-y-1 shadow-inner animate-pulse">
                    <div className="flex items-center gap-2 mb-2 text-white border-b border-slate-800 pb-1.5">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>INTELIGENȚĂ ARTIFICIALĂ GEMINI - SE PROCESEAZĂ...</span>
                    </div>
                    {scanStatusLog.map((log, index) => (
                      <p key={index} className="text-slate-300">
                        <span className="text-slate-500">[{index + 1}]</span> {log}
                      </p>
                    ))}
                  </div>
                )}

                {/* Layout Grid of Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Camera scan card option */}
                  <div className="bg-slate-50/70 p-4 rounded-xl border border-dashed border-slate-200 hover:border-indigo-400 transition-all flex flex-col items-center justify-between text-center group">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl group-hover:scale-105 transition-all">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="mt-3">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Scanează Factura cu Camera</h4>
                      <p className="text-[11px] text-slate-500 leading-normal max-w-xs mx-auto mt-1">
                        Utilizați camera smartphone-ului pentru a fotografia factura fizică de la furnizor. AI Gemini va extrage datele.
                      </p>
                    </div>
                    
                    <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer shadow-md shadow-indigo-100 flex items-center gap-1.5 transition-all mt-4">
                      <Smartphone className="w-3.5 h-3.5" />
                      Pornește Camera / Încarcă Imagine
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleCameraPhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* SPV E-factura XML & Paste */}
                  <div className="bg-slate-50/70 p-4 rounded-xl border border-dashed border-slate-200 hover:border-indigo-400 transition-all flex flex-col items-center justify-between text-center group">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl group-hover:scale-105 transition-all">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="mt-3">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">ANAF E-Factura (SPV) XML</h4>
                      <p className="text-[11px] text-slate-500 leading-normal max-w-xs mx-auto mt-1">
                        Încărcați direct fișierul standard XML descărcat din Spațiul Privat Virtual. Parsare exactă și securizată.
                      </p>
                    </div>
                    
                    <div className="flex gap-2 mt-4 flex-wrap justify-center">
                      <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer shadow-md shadow-indigo-100 transition-all flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5" />
                        Alege Fișier XML
                        <input
                          type="file"
                          accept=".xml"
                          onChange={handleXmlUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={() => setShowXmlInput(!showXmlInput)}
                        className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        Paste XML Text
                      </button>
                    </div>
                  </div>

                </div>

                {/* Paste XML Inline Section */}
                {showXmlInput && (
                  <div className="mt-4 p-4 bg-slate-100 rounded-xl border border-slate-200 animate-fade-in">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Continut XML E-Factura:</label>
                    <textarea
                      value={xmlInputText}
                      onChange={(e) => setXmlInputText(e.target.value)}
                      placeholder="Lipiți codul XML descărcat din ANAF..."
                      rows={5}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono focus:outline-indigo-600"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => setShowXmlInput(false)}
                        className="bg-slate-200 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Renunță
                      </button>
                      <button
                        onClick={handlePasteXmlSubmit}
                        className="bg-slate-900 text-white text-[10px] font-bold px-4 py-1.5 rounded-lg cursor-pointer"
                      >
                        Procesează XML
                      </button>
                    </div>
                  </div>
                )}

                {/* Simulator of ANAF SPV API - Highly appealing! */}
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                    MOCK HUB: Simulare Conexiune SPV ANAF (Descărcare automată facturi)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSimulateSPV(0)}
                      className="bg-white border border-slate-200 hover:border-indigo-500 p-2.5 rounded-xl hover:bg-indigo-50/30 text-left transition-all group flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="block font-bold text-xs text-slate-800">Moara Românească</span>
                        <span className="block text-[9px] text-slate-500">Factură făină (Crește la 5.15 RON)</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    
                    <button
                      onClick={() => handleSimulateSPV(1)}
                      className="bg-white border border-slate-200 hover:border-indigo-500 p-2.5 rounded-xl hover:bg-indigo-50/30 text-left transition-all group flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="block font-bold text-xs text-slate-800">Dinu Distrib Lactate</span>
                        <span className="block text-[9px] text-slate-500">Factură unt/lapte (Modificari)</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    <button
                      onClick={() => handleSimulateSPV(2)}
                      className="bg-white border border-slate-200 hover:border-indigo-500 p-2.5 rounded-xl hover:bg-indigo-50/30 text-left transition-all group flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="block font-bold text-xs text-slate-800">Ambalaje Eco Ind.</span>
                        <span className="block text-[9px] text-slate-500">Factură cutii (Crește la 2.95 RON)</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>

              </div>

              {/* Scanned invoice preview results */}
              {scannedInvoiceResult && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Rezultat Factură Încărcată (Mapează cu Catalog)
                    </h3>
                    <button
                      onClick={() => setScannedInvoiceResult(null)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Ascunde
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-xs mb-4">
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase font-bold">FURNIZOR</span>
                      <strong className="text-slate-900">{scannedInvoiceResult.supplierName}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase font-bold">NR. FACTURĂ</span>
                      <strong className="text-slate-900 font-mono">{scannedInvoiceResult.invoiceNumber}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase font-bold">DATĂ</span>
                      <strong className="text-slate-900">{scannedInvoiceResult.invoiceDate}</strong>
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-100/60 font-bold text-slate-600 border-b border-slate-100">
                          <th className="p-2">Item în Factură</th>
                          <th className="p-2 text-right">Cantitate</th>
                          <th className="p-2 text-right">Preț Fără TVA</th>
                          <th className="p-2 text-right">TVA (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {scannedInvoiceResult.items.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-slate-900">{item.name}</td>
                            <td className="p-2 text-right font-mono text-slate-700">
                              {item.quantity} {item.unitOfMeasure || "buc"}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-900 font-bold">
                              {formatRON(item.unitPriceBeforeVat)}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-500">{item.vatPercent}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: MONTHLY REPORTS, RECHARTS VISUALIZATION & PDF/CSV */}
        {/* ========================================================= */}
        {activeTab === "reports" && (
          <div className="space-y-6">

            {/* Print Header/Period Selector block (no-print) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Filtrează Raportul Profitabilitate</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Selectați luna pentru care generați fișierele de export</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-indigo-600"
                >
                  <option value="All">Toate Lunile (Cumulat)</option>
                  {monthOptions.map(opt => {
                    const parts = opt.split("-");
                    const translationRo: { [key: string]: string } = {
                      "01": "Ianuarie", "02": "Februarie", "03": "Martie", "04": "Aprilie", "05": "Mai", "06": "Iunie",
                      "07": "Iulie", "08": "August", "09": "Septembrie", "10": "Octombrie", "11": "Noiembrie", "12": "Decembrie"
                    };
                    return (
                      <option key={opt} value={opt}>
                        {translationRo[parts[1]] || parts[1]} {parts[0]}
                      </option>
                    );
                  })}
                </select>

                <button
                  onClick={handleExportCSV}
                  className="bg-white border border-slate-200 hover:border-indigo-600 text-slate-700 hover:text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  Exportă CSV
                </button>

                <button
                  onClick={handlePrintPDF}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-indigo-100 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Tipărește / Salvează PDF
                </button>
              </div>
            </div>

            {/* Profitability Charts Grid (using Recharts) - hidden in print for better clean layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
              
              {/* Chart 1: Revenue, Cost, Profit (col-span-8) */}
              <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Evoluție Venituri vs Costuri vs Profit Brut (RON)
                </h3>
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyChartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="Nume" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [`${value} RON`]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Venituri (fara TVA)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Costuri Productie" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Profit Brut" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Product Breakdown Pie/Bar (col-span-4) */}
              <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-amber-500" />
                  Contribuție la Profitul Brut pe Produs
                </h3>
                <div className="flex-1 h-64 sm:h-72 flex items-center justify-center">
                  {productChartData.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      <p className="text-xs font-semibold">Fără date disponibile</p>
                      <p className="text-[10px]">Înregistrați vânzări pentru a vedea graficele.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={productChartData}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(value) => [`${value} RON`]} />
                        <Bar dataKey="Profit total" fill="#e2e8f0">
                          {productChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "#10b981" : "#059669"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            </div>

            {/* Sales Table and Print-ready view */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print-card">
              
              <div className="p-5 border-b border-slate-100 flex items-center justify-between no-print">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Registrul Tranzacțiilor de Vânzare</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Toate înregistrările corespunzătoare perioadei filtrate</p>
                </div>
                <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {filteredSalesList.length} vânzări identificate
                </span>
              </div>

              {/* Print title */}
              <div className="hidden print-only p-4 bg-slate-50 border-b border-slate-200 mb-4">
                <h3 className="font-bold text-slate-800 text-base">Sumar Financiar Perioadă</h3>
                <div className="grid grid-cols-4 gap-4 mt-2 text-xs">
                  <div>
                    <span className="block text-slate-500">Venit Total (fără TVA)</span>
                    <strong className="text-slate-900 font-mono text-sm">{formatRON(periodStats.totalRevenueBeforeVat)}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-500">Venit Total (cu TVA)</span>
                    <strong className="text-slate-900 font-mono text-sm">{formatRON(periodStats.totalRevenueWithVat)}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-500">Cost de Producție Cumulat</span>
                    <strong className="text-slate-900 font-mono text-sm">{formatRON(periodStats.totalCost)}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-500">Profit Brut Net Obținut</span>
                    <strong className="text-emerald-700 font-mono text-sm">{formatRON(periodStats.totalProfit)}</strong>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200/80 font-bold text-slate-600">
                      <th className="p-4">Dată</th>
                      <th className="p-4">Denumire Produs Final</th>
                      <th className="p-4 text-right">Cantitate</th>
                      <th className="p-4 text-right">Preț fără TVA</th>
                      <th className="p-4 text-right">Preț cu TVA</th>
                      <th className="p-4 text-right">Venit fără TVA</th>
                      <th className="p-4 text-right">Profit Brut Generat</th>
                      <th className="p-4 text-right no-print">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredSalesList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          Nu există vânzări înregistrate în această perioadă.
                        </td>
                      </tr>
                    ) : (
                      filteredSalesList.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-mono text-slate-700">
                            {new Date(sale.date).toLocaleDateString("ro-RO")}
                          </td>
                          <td className="p-4 font-bold text-slate-900">{sale.productName}</td>
                          <td className="p-4 text-right font-mono text-slate-950 font-bold">
                            {sale.quantity} buc
                          </td>
                          <td className="p-4 text-right font-mono text-slate-600">
                            {formatRON(sale.salePriceBeforeVat)}
                          </td>
                          <td className="p-4 text-right font-mono text-slate-600 font-semibold">
                            {formatRON(sale.salePriceWithVat)}
                          </td>
                          <td className="p-4 text-right font-mono text-slate-900 font-bold">
                            {formatRON(sale.totalRevenueBeforeVat)}
                          </td>
                          <td className="p-4 text-right font-mono text-emerald-600 font-bold">
                            {formatRON(sale.totalProfit)}
                          </td>
                          <td className="p-4 text-right no-print">
                            <button
                              onClick={() => handleDeleteSale(sale.id)}
                              className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-all"
                              title="Șterge tranzacția"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={2} className="p-4 text-right text-slate-700">Totale Perioadă Filtrată:</td>
                      <td className="p-4 text-right font-mono text-slate-950">
                        {filteredSalesList.reduce((acc, curr) => acc + curr.quantity, 0)} buc
                      </td>
                      <td colSpan={2} className="p-4"></td>
                      <td className="p-4 text-right font-mono text-slate-950">
                        {formatRON(periodStats.totalRevenueBeforeVat)}
                      </td>
                      <td className="p-4 text-right font-mono text-emerald-700 text-sm">
                        {formatRON(periodStats.totalProfit)}
                      </td>
                      <td className="p-4 no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

            </div>

          </div>
        )}

        </div>
      </main>
      
    </div>
  );
}
