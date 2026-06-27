import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import {
  Calculator,
  Camera,
  FileText,
  FileArchive,
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
  CheckSquare,
  Database,
  Search,
  GitMerge
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
import { calculateSalePrice, formatRON, formatPercent, parseEFacturaXML, exportToCSV, normalizeMaterialName, removeDiacritics, getRecipeItemUnit, getRecipeItemFactor } from "./utils";

export default function App() {
  // --- STATE ---
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(() => {
    const saved = localStorage.getItem("raw_materials");
    let loaded: RawMaterial[] = [];
    if (saved === null) {
      loaded = INITIAL_RAW_MATERIALS;
    } else {
      try {
        loaded = JSON.parse(saved);
      } catch {
        loaded = [];
      }
    }
    // Normalize and remove duplicates to guarantee clean data on start
    const normalizedList: RawMaterial[] = [];
    loaded.forEach(rm => {
      const cleanName = normalizeMaterialName(rm.name);
      if (!normalizedList.some(item => normalizeMaterialName(item.name) === cleanName)) {
        normalizedList.push({
          ...rm,
          name: cleanName
        });
      }
    });
    return normalizedList;
  });

  const [products, setProducts] = useState<FinalProduct[]>(() => {
    const saved = localStorage.getItem("final_products");
    if (saved === null) return INITIAL_PRODUCTS;
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [sales, setSales] = useState<SaleRecord[]>(() => {
    const saved = localStorage.getItem("sales_history");
    if (saved === null) return INITIAL_SALES;
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const saved = localStorage.getItem("price_alerts");
    return saved ? JSON.parse(saved) || [] : [];
  });

  // UI state
  const [activeTab, setActiveTab] = useState<"calculator" | "inventory" | "reports">("calculator");
  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    const saved = localStorage.getItem("final_products");
    if (saved === null) return INITIAL_PRODUCTS[0]?.id || "";
    try {
      const parsed = JSON.parse(saved);
      return parsed[0]?.id || "";
    } catch {
      return "";
    }
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
  const [newProdMargin, setNewProdMargin] = useState("20");
  const [newProdVat, setNewProdVat] = useState("11");
  const [newProdRecipe, setNewProdRecipe] = useState<{ rawMaterialId: string; quantityNeeded: number }[]>([
    { rawMaterialId: "", quantityNeeded: 0 }
  ]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProdCalories, setNewProdCalories] = useState("");
  const [newProdAllergens, setNewProdAllergens] = useState("");

  // PDF Recipe Parsing states
  const [isRecipeParsing, setIsRecipeParsing] = useState(false);
  const [showRecipeImportModal, setShowRecipeImportModal] = useState(false);
  const [parsedRecipe, setParsedRecipe] = useState<{
    productName: string;
    calories?: number;
    allergens?: string[];
    ingredients: {
      name: string;
      quantityNeeded: number;
      unit: string;
      notes?: string;
    }[];
  } | null>(null);
  const [recipeIngredientMappings, setRecipeIngredientMappings] = useState<any[]>([]);

  // Sale registering state
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Invoice scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusLog, setScanStatusLog] = useState<string[]>([]);
  const [scannedInvoiceResult, setScannedInvoiceResult] = useState<ScannedInvoice | null>(null);
  const [uploadedInvoicesQueue, setUploadedInvoicesQueue] = useState<ScannedInvoice[]>([]);
  const [invoiceMappings, setInvoiceMappings] = useState<any[] | null>(null);
  const [isMappingInvoice, setIsMappingInvoice] = useState(false);
  const [xmlInputText, setXmlInputText] = useState("");
  const [showXmlInput, setShowXmlInput] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRawMaterialModal, setShowRawMaterialModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [ignoredDuplicates, setIgnoredDuplicates] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("ignored_duplicates");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recipeFileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterMonth, setFilterMonth] = useState("All");
  const [searchRmQuery, setSearchRmQuery] = useState("");
  const [selectedRmLetter, setSelectedRmLetter] = useState("ALL");

  // Alert system check
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // ANAF SPV OAuth connection states
  const [anafConnected, setAnafConnected] = useState<boolean>(() => {
    return localStorage.getItem("anaf_connected") === "true";
  });
  const [anafCompany, setAnafCompany] = useState<string>(() => {
    return localStorage.getItem("anaf_company") || "";
  });
  const [anafCif, setAnafCif] = useState<string>(() => {
    return localStorage.getItem("anaf_cif") || "";
  });
  const [anafExpiresAt, setAnafExpiresAt] = useState<string>(() => {
    return localStorage.getItem("anaf_expires_at") || "";
  });
  const [isSyncingAnaf, setIsSyncingAnaf] = useState(false);

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

  useEffect(() => {
    localStorage.setItem("ignored_duplicates", JSON.stringify(ignoredDuplicates));
  }, [ignoredDuplicates]);

  useEffect(() => {
    localStorage.setItem("anaf_connected", String(anafConnected));
    localStorage.setItem("anaf_company", anafCompany);
    localStorage.setItem("anaf_cif", anafCif);
    localStorage.setItem("anaf_expires_at", anafExpiresAt);
  }, [anafConnected, anafCompany, anafCif, anafExpiresAt]);

  useEffect(() => {
    // 1. Handle postMessage from popups (if window.opener is working)
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        return;
      }
      
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        setAnafConnected(true);
        setAnafCompany(event.data.company || "Almada Invest SRL");
        setAnafCif(event.data.cif || "RO39281920");
        setAnafExpiresAt(event.data.expiresAt || "");
        triggerToast("Contul ANAF SPV a fost conectat cu succes prin OAuth!", "success");
      }
    };
    
    // 2. Handle BroadcastChannel (extremely robust cross-window communication for same origin)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('anaf_oauth_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
          setAnafConnected(true);
          setAnafCompany(event.data.company || "Almada Invest SRL");
          setAnafCif(event.data.cif || "RO39281920");
          setAnafExpiresAt(event.data.expiresAt || "");
          triggerToast("Contul ANAF SPV a fost conectat cu succes prin OAuth!", "success");
        }
      };
    } catch (e) {
      console.error("BroadcastChannel not supported in this browser", e);
    }

    // 3. Handle localStorage change (if the popup directly writes to localStorage, other tabs of the same origin are notified instantly)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "anaf_connected" && event.newValue === "true") {
        const company = localStorage.getItem("anaf_company") || "Almada Invest SRL";
        const cif = localStorage.getItem("anaf_cif") || "RO39281920";
        const expiresAt = localStorage.getItem("anaf_expires_at") || "";
        setAnafConnected(true);
        setAnafCompany(company);
        setAnafCif(cif);
        setAnafExpiresAt(expiresAt);
        triggerToast("Contul ANAF SPV a fost conectat cu succes!", "success");
      }
    };
    
    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorageChange);
      if (bc) {
        bc.close();
      }
    };
  }, []);

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

    const normalizedName = normalizeMaterialName(newRmName);
    if (!normalizedName) {
      triggerToast("Numele materiei prime nu poate fi gol.", "error");
      return;
    }

    // Check if another material already has this normalized name to ensure uniqueness
    const duplicate = rawMaterials.find(rm => rm.id !== editingRmId && normalizeMaterialName(rm.name) === normalizedName);
    if (duplicate) {
      triggerToast(`Materia primă "${normalizedName}" există deja în catalog (poziții unice)!`, "error");
      return;
    }

    if (editingRmId) {
      // Update existing
      setRawMaterials(prev =>
        prev.map(rm =>
          rm.id === editingRmId
            ? {
                ...rm,
                name: normalizedName,
                unit: newRmUnit,
                purchasePriceBeforeVat: priceNum,
                vatPercent: vatNum,
                lastUpdated: new Date().toISOString()
              }
            : rm
        )
      );
      triggerToast(`Materia primă "${normalizedName}" a fost actualizată!`);
      setEditingRmId(null);
    } else {
      // Create new
      const newRm: RawMaterial = {
        id: `rm-${Date.now()}`,
        name: normalizedName,
        unit: newRmUnit,
        purchasePriceBeforeVat: priceNum,
        vatPercent: vatNum,
        lastUpdated: new Date().toISOString()
      };
      setRawMaterials(prev => [...prev, newRm]);
      triggerToast(`Materia primă "${normalizedName}" a fost adăugată cu succes!`);
    }

    // Reset form
    setNewRmName("");
    setNewRmPrice("");
    setNewRmUnit("kg");
    setNewRmVat("11");
    setShowRawMaterialModal(false);
  };

  const handleEditRm = (rm: RawMaterial) => {
    setEditingRmId(rm.id);
    setNewRmName(rm.name);
    setNewRmUnit(rm.unit);
    setNewRmPrice(rm.purchasePriceBeforeVat.toString());
    setNewRmVat(rm.vatPercent.toString());
    setShowRawMaterialModal(true);
  };

  const handleDeleteRm = (id: string, name: string) => {
    // Check if used in any product recipe
    const isUsed = products.some(p => p.recipeItems.some(item => item.rawMaterialId === id));
    if (isUsed) {
      triggerToast(`Materia primă "${name}" este utilizată într-o rețetă activă și nu poate fi ștearsă!`, "error");
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Ștergere Materie Primă",
      message: `Sigur doriți să ștergeți materia primă "${name}"? Toate alertele de preț asociate vor fi de asemenea eliminate.`,
      onConfirm: () => {
        setRawMaterials(prev => prev.filter(rm => rm.id !== id));
        setAlerts(prev => prev.filter(al => al.rawMaterialId !== id));
        triggerToast(`Materia primă "${name}" a fost ștearsă.`);
      }
    });
  };

  const handleMergeRawMaterials = () => {
    if (!mergeSourceId || !mergeTargetId) {
      triggerToast("Vă rugăm să selectați ambele materii prime.", "error");
      return;
    }

    if (mergeSourceId === mergeTargetId) {
      triggerToast("Materia primă sursă nu poate fi aceeași cu materia primă destinație.", "error");
      return;
    }

    const sourceRm = rawMaterials.find(rm => rm.id === mergeSourceId);
    const targetRm = rawMaterials.find(rm => rm.id === mergeTargetId);

    if (!sourceRm || !targetRm) {
      triggerToast("Materia primă selectată este invalidă.", "error");
      return;
    }

    // Merge logic
    // Update all product recipes using the source and replace them with target
    const updatedProducts = products.map(p => {
      const hasSource = p.recipeItems.some(item => item.rawMaterialId === mergeSourceId);
      if (!hasSource) return p;

      const newRecipeItems: { rawMaterialId: string; quantityNeeded: number }[] = [];
      p.recipeItems.forEach(item => {
        const idToUse = item.rawMaterialId === mergeSourceId ? mergeTargetId : item.rawMaterialId;
        const existing = newRecipeItems.find(ni => ni.rawMaterialId === idToUse);
        if (existing) {
          existing.quantityNeeded += item.quantityNeeded;
        } else {
          newRecipeItems.push({
            rawMaterialId: idToUse,
            quantityNeeded: item.quantityNeeded
          });
        }
      });

      return {
        ...p,
        recipeItems: newRecipeItems
      };
    });

    // Filter out the source raw material
    const updatedRawMaterials = rawMaterials.filter(rm => rm.id !== mergeSourceId);

    // Filter out alerts associated with the source
    const updatedAlerts = alerts.filter(al => al.rawMaterialId !== mergeSourceId);

    // Set state
    setRawMaterials(updatedRawMaterials);
    setProducts(updatedProducts);
    setAlerts(updatedAlerts);

    // Save to local storage
    localStorage.setItem("raw_materials", JSON.stringify(updatedRawMaterials));
    localStorage.setItem("final_products", JSON.stringify(updatedProducts));

    triggerToast(
      `Unificare finalizată cu succes! Toate rețetele care foloseau "${sourceRm.name}" au fost actualizate automat să folosească "${targetRm.name}" la prețul de ${formatRON(targetRm.purchasePriceBeforeVat)}.`
    );

    // Reset state & close modal
    setMergeSourceId("");
    setMergeTargetId("");
    setShowMergeModal(false);
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
    const caloriesNum = newProdCalories ? parseInt(newProdCalories) : undefined;
    const allergensArr = newProdAllergens
      ? newProdAllergens.split(",").map(s => removeDiacritics(s).trim().toUpperCase()).filter(Boolean)
      : [];

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
                customVatPercent: vat,
                calories: caloriesNum,
                allergens: allergensArr
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
        customVatPercent: vat,
        calories: caloriesNum,
        allergens: allergensArr
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
    setNewProdMargin("20");
    setNewProdVat("11");
    setNewProdCalories("");
    setNewProdAllergens("");
    setNewProdRecipe([{ rawMaterialId: "", quantityNeeded: 0 }]);
  };

  const handleEditProduct = (prod: FinalProduct) => {
    setEditingProductId(prod.id);
    setNewProdName(prod.name);
    setNewProdLogistics(prod.logisticsCost.toString());
    setNewProdTaxes(prod.otherTaxesCost.toString());
    setNewProdMargin(prod.customMarginPercent.toString());
    setNewProdVat(prod.customVatPercent.toString());
    setNewProdCalories(prod.calories !== undefined ? prod.calories.toString() : "");
    setNewProdAllergens(prod.allergens ? prod.allergens.join(", ") : "");
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

    setConfirmDialog({
      isOpen: true,
      title: "Ștergere Produs",
      message: `Sigur doriți să ștergeți produsul "${name}"? Această acțiune este permanentă.`,
      onConfirm: () => {
        setProducts(prev => prev.filter(p => p.id !== id));
        if (selectedProductId === id) {
          setSelectedProductId(products.find(p => p.id !== id)?.id || "");
        }
        triggerToast(`Produsul "${name}" a fost șters.`);
      }
    });
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
    setConfirmDialog({
      isOpen: true,
      title: "Ștergere Vânzare",
      message: "Sigur doriți să ștergeți această vânzare înregistrată? Această acțiune va schimba statisticile de profit.",
      onConfirm: () => {
        setSales(prev => prev.filter(s => s.id !== id));
        triggerToast("Înregistrarea vânzării a fost ștearsă.");
      }
    });
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
        setUploadedInvoicesQueue(prev => {
          if (prev.some(inv => inv.invoiceNumber === scannedInv.invoiceNumber && inv.supplierName === scannedInv.supplierName)) {
            return prev;
          }
          return [...prev, scannedInv];
        });
        triggerToast("Factura E-factura XML a fost procesată cu succes!");
        runIntelligentInvoiceMapping(scannedInv);
      } catch (err: any) {
        triggerToast(err.message || "Eroare la procesarea fișierului XML", "error");
      }
    };
    reader.readAsText(file);
  };

  // --- ZIP ARCHIVES UPLOADER FOR MULTIPLE XMLs ---
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanning(true);
    setScanStatusLog(["Se inițializează cititorul ZIP...", "Se dezarhivează fișierele selectate..."]);

    const newInvoices: ScannedInvoice[] = [];
    const errors: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setScanStatusLog(prev => [...prev, `Se procesează arhiva: ${file.name}...`]);

        if (file.name.toLowerCase().endsWith(".zip")) {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(file);
          
          const xmlEntries: { name: string; zipEntry: any }[] = [];
          loadedZip.forEach((relativePath, zipEntry) => {
            if (zipEntry.name.toLowerCase().endsWith(".xml") && !zipEntry.dir) {
              xmlEntries.push({ name: zipEntry.name, zipEntry });
            }
          });

          if (xmlEntries.length === 0) {
            errors.push(`Fișierul ZIP "${file.name}" nu conține facturi .xml valide.`);
            continue;
          }

          setScanStatusLog(prev => [...prev, `S-au găsit ${xmlEntries.length} fișiere XML în "${file.name}". Se dezarhivează...`]);

          for (const entry of xmlEntries) {
            try {
              const xmlContent = await entry.zipEntry.async("string");
              const parsed = parseEFacturaXML(xmlContent);
              newInvoices.push({
                id: `inv-zip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                supplierName: parsed.supplierName,
                invoiceNumber: parsed.invoiceNumber,
                invoiceDate: parsed.invoiceDate,
                items: parsed.items,
                status: "pending"
              });
            } catch (xmlErr: any) {
              errors.push(`Articolul "${entry.name}" din "${file.name}" nu a putut fi parsat: ${xmlErr.message}`);
            }
          }
        } else {
          errors.push(`Fișierul "${file.name}" nu are extensia .zip.`);
        }
      }
    } catch (zipErr: any) {
      errors.push(`Eroare generală la procesarea arhivei ZIP: ${zipErr.message}`);
    } finally {
      setIsScanning(false);
      setScanStatusLog([]);
    }

    if (errors.length > 0) {
      triggerToast(`Unele erori au apărut la procesare: ${errors.slice(0, 3).join(" | ")}`, "error");
    }

    if (newInvoices.length > 0) {
      triggerToast(`S-au importat cu succes ${newInvoices.length} facturi XML din arhivele ZIP!`, "success");
      
      setUploadedInvoicesQueue(prev => {
        const filteredNew = newInvoices.filter(
          newInv => !prev.some(p => p.invoiceNumber === newInv.invoiceNumber && p.supplierName === newInv.supplierName)
        );
        const combined = [...prev, ...filteredNew];
        
        if (!scannedInvoiceResult && combined.length > 0) {
          const firstPending = combined.find(c => c.status === "pending") || combined[0];
          setScannedInvoiceResult(firstPending);
          runIntelligentInvoiceMapping(firstPending);
        }
        return combined;
      });
    } else if (errors.length === 0) {
      triggerToast("Nu s-au găsit facturi XML valide în arhivele ZIP încărcate.", "info");
    }
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
      setUploadedInvoicesQueue(prev => {
        if (prev.some(inv => inv.invoiceNumber === scannedInv.invoiceNumber && inv.supplierName === scannedInv.supplierName)) {
          return prev;
        }
        return [...prev, scannedInv];
      });
      setShowXmlInput(false);
      setXmlInputText("");
      triggerToast("Factura XML din text a fost procesată!");
      runIntelligentInvoiceMapping(scannedInv);
    } catch (err: any) {
      triggerToast(err.message || "Eroare la procesarea textului XML", "error");
    }
  };

  // 3. Recipe PDF Parser event handlers
  const handleRecipePdfSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      triggerToast("Vă rugăm să selectați un fișier PDF valid.", "error");
      return;
    }

    setIsRecipeParsing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
      });

      const response = await fetch("/api/parse-recipe-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64 })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Eroare la procesarea serverului.");
      }

      const data = await response.json();
      if (data.success && data.recipe) {
        const recipe = data.recipe;
        setParsedRecipe(recipe);

        // Auto-map ingredients
        const initialMappings = recipe.ingredients.map((ing: any, idx: number) => {
          const cleanIngName = normalizeMaterialName(ing.name);
          const matchedRm = rawMaterials.find(
            rm => normalizeMaterialName(rm.name) === cleanIngName || 
                  normalizeMaterialName(rm.name).includes(cleanIngName) ||
                  cleanIngName.includes(normalizeMaterialName(rm.name))
          );

          return {
            index: idx,
            name: ing.name,
            quantityNeeded: ing.quantityNeeded,
            unit: ing.unit || "kg",
            notes: ing.notes || "",
            matchType: matchedRm ? "existing" : "new",
            existingMaterialId: matchedRm ? matchedRm.id : "",
            newRmName: removeDiacritics(ing.name).trim().toUpperCase(),
            newRmUnit: ing.unit || "kg",
            newRmPrice: "0",
            newRmVat: "11"
          };
        });

        setRecipeIngredientMappings(initialMappings);
        setShowRecipeImportModal(true);
        triggerToast("Rețeta PDF a fost analizată cu succes de Gemini!");
      } else {
        throw new Error("Datele extrase din rețetă sunt nevalide.");
      }
    } catch (err: any) {
      console.error("Error importing recipe PDF:", err);
      triggerToast(`Eroare la citirea PDF-ului: ${err.message}`, "error");
    } finally {
      setIsRecipeParsing(false);
      e.target.value = "";
    }
  };

  const handleMappingRowChange = (index: number, field: string, value: any) => {
    setRecipeIngredientMappings((prev) =>
      prev.map((m, idx) => {
        if (idx !== index) return m;
        const updated = { ...m, [field]: value };
        if (field === "matchType" && value === "new") {
          updated.newRmName = removeDiacritics(m.name).trim().toUpperCase();
        }
        if (field === "existingMaterialId" && value) {
          const rm = rawMaterials.find(r => r.id === value);
          if (rm) {
            updated.unit = rm.unit;
          }
        }
        return updated;
      })
    );
  };

  const handleFinalizeRecipeImport = () => {
    if (!parsedRecipe) return;

    // Validate mappings
    for (const mapping of recipeIngredientMappings) {
      if (mapping.matchType === "existing" && !mapping.existingMaterialId) {
        triggerToast(`Vă rugăm să alegeți o materie primă existentă pentru "${mapping.name}".`, "error");
        return;
      }
      if (mapping.matchType === "new" && !mapping.newRmName.trim()) {
        triggerToast(`Numele materiei prime noi pentru "${mapping.name}" nu poate fi gol.`, "error");
        return;
      }
    }

    // Create any new raw materials
    let updatedRawMaterials = [...rawMaterials];
    const mappingsWithFinalIds = recipeIngredientMappings.map((mapping) => {
      if (mapping.matchType === "new") {
        const newRmId = `rm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newMaterial: RawMaterial = {
          id: newRmId,
          name: removeDiacritics(mapping.newRmName).trim().toUpperCase(),
          unit: mapping.newRmUnit,
          purchasePriceBeforeVat: parseFloat(mapping.newRmPrice) || 0,
          vatPercent: parseFloat(mapping.newRmVat) || 11,
          lastUpdated: new Date().toISOString()
        };
        updatedRawMaterials.push(newMaterial);
        return { ...mapping, finalMaterialId: newRmId };
      } else {
        return { ...mapping, finalMaterialId: mapping.existingMaterialId };
      }
    });

    // Save updated raw materials
    setRawMaterials(updatedRawMaterials);
    localStorage.setItem("raw_materials", JSON.stringify(updatedRawMaterials));

    // Create the Final Product
    const newProductId = `p-${Date.now()}`;
    const recipeItems = mappingsWithFinalIds.map((m) => ({
      rawMaterialId: m.finalMaterialId,
      quantityNeeded: m.quantityNeeded
    }));

    const newProduct: FinalProduct = {
      id: newProductId,
      name: removeDiacritics(parsedRecipe.productName).trim().toUpperCase(),
      recipeItems,
      logisticsCost: 0,
      otherTaxesCost: 0,
      customMarginPercent: 20,
      customVatPercent: 11,
      calories: parsedRecipe.calories || undefined,
      allergens: parsedRecipe.allergens || []
    };

    setProducts((prev) => [...prev, newProduct]);
    setSelectedProductId(newProductId);
    setShowRecipeImportModal(false);
    setParsedRecipe(null);
    setRecipeIngredientMappings([]);

    triggerToast(`Rețeta "${newProduct.name}" a fost importată cu succes!`);
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
        setUploadedInvoicesQueue(prev => {
          if (prev.some(inv => inv.invoiceNumber === scannedInv.invoiceNumber && inv.supplierName === scannedInv.supplierName)) {
            return prev;
          }
          return [...prev, scannedInv];
        });
        setScanStatusLog(prev => [...prev, "Procesare AI finalizată!", "Analiză semantizare ingrediente..."]);
        setTimeout(() => {
          setIsScanning(false);
          setScanStatusLog([]);
          triggerToast("Factura a fost scanată cu camera prin AI Gemini!");
          runIntelligentInvoiceMapping(scannedInv);
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

  // --- ANAF SPV REAL OAUTH ACTIONS ---
  const handleConnectAnaf = () => {
    const width = 650;
    const height = 750;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      "/api/auth/anaf/url",
      "anaf_oauth",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );
    
    if (!popup) {
      triggerToast("Popup-ul a fost blocat de browser. Te rugăm să activezi pop-up-urile pentru acest site.", "error");
    }
  };

  const handleDisconnectAnaf = () => {
    setAnafConnected(false);
    setAnafCompany("");
    setAnafCif("");
    setAnafExpiresAt("");
    triggerToast("Contul ANAF SPV a fost deconectat de la această aplicație.", "info");
  };

  const handleResetAllData = () => {
    setShowResetConfirm(true);
  };

  const performResetAllData = () => {
    // Clear localStorage explicitly to empty arrays
    localStorage.setItem("raw_materials", JSON.stringify([]));
    localStorage.setItem("final_products", JSON.stringify([]));
    localStorage.setItem("sales_history", JSON.stringify([]));
    localStorage.setItem("price_alerts", JSON.stringify([]));
    
    // Update state
    setRawMaterials([]);
    setProducts([]);
    setSales([]);
    setAlerts([]);
    setSelectedProductId("");
    
    triggerToast("Aplicația a fost resetată complet! Toate datele au fost șterse.", "info");
  };

  const handleSyncAnaf = async () => {
    if (!anafConnected) {
      triggerToast("Conectați mai întâi contul dumneavoastră ANAF SPV prin OAuth.", "error");
      return;
    }
    
    setIsScanning(true);
    setScanStatusLog([
      `Conectare la ANAF API Gateway folosind token OAuth securizat...`,
      `Interogare SPV e-Factura pentru CIF ${anafCif}...`,
      `Se caută facturi transmise în ultimele 24 de ore...`
    ]);

    try {
      const response = await fetch("/api/anaf/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cif: anafCif })
      });

      if (!response.ok) {
        throw new Error("Conexiunea cu API ANAF a eșuat.");
      }

      const result = await response.json();
      if (result.success && result.invoice) {
        setScanStatusLog(prev => [
          ...prev,
          `Descărcare XML UBL oficial pentru factura ${result.invoice.invoiceNumber}...`,
          `Verificare semnătură digitală minister...`,
          `Factură nouă descărcată cu succes!`
        ]);

        setTimeout(() => {
          const scannedInv: ScannedInvoice = {
            id: `inv-spv-${Date.now()}`,
            supplierName: result.invoice.supplierName,
            invoiceNumber: result.invoice.invoiceNumber,
            invoiceDate: result.invoice.invoiceDate,
            items: result.invoice.items,
            status: "pending"
          };

          setScannedInvoiceResult(scannedInv);
          setIsScanning(false);
          setScanStatusLog([]);
          triggerToast(`Sincronizare Reușită! Factura ${scannedInv.invoiceNumber} de la ${scannedInv.supplierName} a fost descărcată.`, "success");
          runIntelligentInvoiceMapping(scannedInv);
        }, 1500);
      } else {
        throw new Error("Nu s-au găsit facturi noi în SPV.");
      }
    } catch (err: any) {
      setIsScanning(false);
      setScanStatusLog([]);
      triggerToast(err.message || "Eroare la interogarea SPV ANAF", "error");
    }
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

    // Realistic mock invoices for catering & cooked food suppliers (Fabrica de Platouri)
    const mocks = [
      {
        supplierName: "Carmangeria Popescu SRL",
        invoiceNumber: "CP-9810",
        invoiceDate: new Date().toISOString().split("T")[0],
        items: [
          { name: "PIEPT PUI CASEROLA DEZOSAT", quantity: 35, unitOfMeasure: "kg", unitPriceBeforeVat: 25.50, vatPercent: 9 }, // Increased from 22.50
          { name: "CEAFA PORC FARA OS CASEROLA", quantity: 20, unitOfMeasure: "kg", unitPriceBeforeVat: 26.10, vatPercent: 9 } // Decreased from 27.00
        ]
      },
      {
        supplierName: "Metro Cash & Carry SRL",
        invoiceNumber: "METRO-4412",
        invoiceDate: new Date().toISOString().split("T")[0],
        items: [
          { name: "ROSI PROASPETE CAL. I", quantity: 40, unitOfMeasure: "kg", unitPriceBeforeVat: 8.20, vatPercent: 9 }, // Increased from 7.50
          { name: "ULEI FLOAREA SOARELUI BUNI 1L", quantity: 60, unitOfMeasure: "l", unitPriceBeforeVat: 5.90, vatPercent: 9 }, // Decreased from 6.50
          { name: "CASTRAVETI FABIO RO", quantity: 25, unitOfMeasure: "kg", unitPriceBeforeVat: 6.00, vatPercent: 9 } // Stable price
        ]
      },
      {
        supplierName: "Ambalaje HoReCa Distrib SRL",
        invoiceNumber: "AHD-0029",
        invoiceDate: new Date().toISOString().split("T")[0],
        items: [
          { name: "AMBALAJ PLATOU PLASTIC NEGRU 45CM", quantity: 200, unitOfMeasure: "buc", unitPriceBeforeVat: 3.90, vatPercent: 19 } // Increased from 3.50
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
        setUploadedInvoicesQueue(prev => {
          if (prev.some(inv => inv.invoiceNumber === scannedInv.invoiceNumber && inv.supplierName === scannedInv.supplierName)) {
            return prev;
          }
          return [...prev, scannedInv];
        });
        setIsScanning(false);
        setScanStatusLog([]);
        triggerToast(`Factura ${selectedMock.invoiceNumber} a fost descărcată din SPV ANAF!`);
        runIntelligentInvoiceMapping(scannedInv);
      }, 1500);
    }, 1500);
  };

  // --- INTELLIGENT AI MAPPING ENGINE ---
  const runIntelligentInvoiceMapping = async (invoice: ScannedInvoice) => {
    setIsMappingInvoice(true);
    setInvoiceMappings(null);
    try {
      const response = await fetch("/api/gemini/map-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: invoice.items,
          existingMaterials: rawMaterials
        })
      });

      if (!response.ok) {
        throw new Error("Cererea de mapare a eșuat");
      }

      const result = await response.json();
      if (result.success && result.mapping) {
        // Enriched mapping state
        const enriched = result.mapping.map((mapItem: any) => {
          const originalItem = invoice.items[mapItem.invoiceItemIndex];
          return {
            ...mapItem,
            originalName: originalItem.name,
            quantity: originalItem.quantity,
            unitOfMeasure: originalItem.unitOfMeasure || mapItem.unit,
            unitPriceBeforeVat: originalItem.unitPriceBeforeVat,
            vatPercent: originalItem.vatPercent
          };
        });
        setInvoiceMappings(enriched);
        triggerToast("AI a realizat maparea inteligentă a ingredientelor din factură!", "success");
      } else {
        throw new Error("Structură de mapare invalidă");
      }
    } catch (err) {
      console.error("Fallback mapping used due to:", err);
      // Fallback to local regex/substring matching if offline or error occurs
      const localHeuristicMapping = invoice.items.map((item, idx) => {
        const matchingRm = rawMaterials.find(
          rm =>
            rm.name.toLowerCase().includes(item.name.toLowerCase()) ||
            item.name.toLowerCase().includes(rm.name.toLowerCase())
        );

        return {
          invoiceItemIndex: idx,
          matchType: matchingRm ? "existing" : "new",
          existingMaterialId: matchingRm ? matchingRm.id : null,
          suggestedCleanName: matchingRm ? matchingRm.name : normalizeMaterialName(item.name.replace(/\d+/g, '').replace(/\b(kg|l|buc|ml|gr)\b/gi, '')),
          unit: item.unitOfMeasure || "kg",
          originalName: item.name,
          quantity: item.quantity,
          unitOfMeasure: item.unitOfMeasure || "kg",
          unitPriceBeforeVat: item.unitPriceBeforeVat,
          vatPercent: item.vatPercent
        };
      });
      setInvoiceMappings(localHeuristicMapping);
      triggerToast("S-a realizat maparea locală a ingredientelor (asistența AI indisponibilă).", "info");
    } finally {
      setIsMappingInvoice(false);
    }
  };

  const handleApplyInvoiceMappings = (invoice: ScannedInvoice) => {
    if (!invoiceMappings || invoiceMappings.length === 0) return;

    let newRmCount = 0;
    let updatedPriceCount = 0;
    const newAlerts: PriceAlert[] = [];
    
    // We will build a new array of raw materials
    let updatedRawMaterials = [...rawMaterials];

    invoiceMappings.forEach((map) => {
      const cleanName = normalizeMaterialName(map.suggestedCleanName);
      
      // Check if this material ALREADY exists under this exact normalized name in updatedRawMaterials
      const existingRm = updatedRawMaterials.find(rm => normalizeMaterialName(rm.name) === cleanName);
      
      if (existingRm) {
        // Already exists in catalog under this name. Treat as existing and update price to avoid duplicates!
        const oldPrice = existingRm.purchasePriceBeforeVat;
        const newPrice = map.unitPriceBeforeVat;

        if (Math.abs(oldPrice - newPrice) > 0.01) {
          const type = newPrice > oldPrice ? "price_increase" : "price_decrease";
          const alert: PriceAlert = {
            id: `alert-${Date.now()}-${existingRm.id}`,
            type,
            rawMaterialId: existingRm.id,
            rawMaterialName: existingRm.name,
            oldPrice,
            newPrice,
            invoiceNumber: invoice.invoiceNumber,
            supplierName: invoice.supplierName,
            date: invoice.invoiceDate,
            resolved: false
          };
          newAlerts.push(alert);
          updatedPriceCount++;
        }

        const index = updatedRawMaterials.findIndex(rm => rm.id === existingRm.id);
        if (index !== -1) {
          updatedRawMaterials[index] = {
            ...existingRm,
            name: cleanName, // standardized without diacritics
            purchasePriceBeforeVat: newPrice,
            vatPercent: map.vatPercent || existingRm.vatPercent,
            lastUpdated: new Date().toISOString()
          };
        }
      } else if (map.matchType === "new" || !map.existingMaterialId) {
        // Create new raw material
        const newRmId = `rm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newRm: RawMaterial = {
          id: newRmId,
          name: cleanName,
          unit: map.unit || "kg",
          purchasePriceBeforeVat: map.unitPriceBeforeVat,
          vatPercent: map.vatPercent || 11,
          lastUpdated: new Date().toISOString()
        };
        updatedRawMaterials.push(newRm);
        newRmCount++;
      } else {
        // Update existing raw material
        const index = updatedRawMaterials.findIndex(rm => rm.id === map.existingMaterialId);
        if (index !== -1) {
          const matchingRm = updatedRawMaterials[index];
          const oldPrice = matchingRm.purchasePriceBeforeVat;
          const newPrice = map.unitPriceBeforeVat;

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
            updatedPriceCount++;
          }

          // In both cases, update current price to latest from SPV
          updatedRawMaterials[index] = {
            ...matchingRm,
            name: cleanName, // standardized without diacritics
            purchasePriceBeforeVat: newPrice,
            vatPercent: map.vatPercent || matchingRm.vatPercent,
            lastUpdated: new Date().toISOString()
          };
        }
      }
    });

    // Save state
    setRawMaterials(updatedRawMaterials);
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev]);
    }

    // Clear preview
    setScannedInvoiceResult(null);
    setInvoiceMappings(null);

    // Mark invoice as applied in queue
    setUploadedInvoicesQueue(prev => {
      const updated = prev.map(inv => inv.id === invoice.id ? { ...inv, status: "applied" as const } : inv);
      // Try to find the next pending invoice to map automatically
      const nextPending = updated.find(inv => inv.status === "pending");
      if (nextPending) {
        setTimeout(() => {
          setScannedInvoiceResult(nextPending);
          runIntelligentInvoiceMapping(nextPending);
        }, 1200);
      }
      return updated;
    });

    // Beautiful UI Toast
    if (newRmCount > 0 && updatedPriceCount > 0) {
      triggerToast(`Succes! S-au creat ${newRmCount} poziții noi și s-au actualizat ${updatedPriceCount} prețuri în catalog.`, "success");
    } else if (newRmCount > 0) {
      triggerToast(`Succes! S-au creat ${newRmCount} materii prime noi în catalog.`, "success");
    } else if (updatedPriceCount > 0) {
      triggerToast(`Succes! S-au actualizat ${updatedPriceCount} prețuri de achiziție în catalog.`, "success");
    } else {
      triggerToast("Sincronizare completă. Toate prețurile din factură coincid deja cu catalogul.", "success");
    }
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

  const possibleDuplicates = React.useMemo(() => {
    const duplicates: { rm1: RawMaterial; rm2: RawMaterial; confidence: "high" | "medium" }[] = [];
    const processed = new Set<string>();

    // Pre-calculate lowercased names without diacritics and their words for extreme performance speedup
    const prepared = rawMaterials.map(rm => {
      const nameNorm = removeDiacritics(rm.name).toLowerCase();
      const words = nameNorm.split(/[^a-z0-9]+/i).filter(w => w.length >= 3);
      return { rm, nameNorm, words };
    });

    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        const p1 = prepared[i];
        const p2 = prepared[j];

        const key = [p1.rm.id, p2.rm.id].sort().join("-");
        if (ignoredDuplicates.includes(key)) continue;

        if (p1.words.length === 0 || p2.words.length === 0) continue;

        const intersection = p1.words.filter(w => p2.words.includes(w));
        const unionSize = new Set([...p1.words, ...p2.words]).size;
        const jaccard = intersection.length / unionSize;

        const isSubstring = p1.nameNorm.includes(p2.nameNorm) || p2.nameNorm.includes(p1.nameNorm);

        // Avoid false positives like "Murber Barbeque" and "Murber BO-R" where intersection is only 1 word ("murber")
        // and they are not substrings of each other, or if they are substrings but the shorter name has only 1 word and the longer name has other completely different words.
        if (intersection.length === 1) {
          const isOneWordExact = p1.words.length === 1 || p2.words.length === 1;
          if (!isSubstring || !isOneWordExact) {
            continue; 
          }
        }

        if (jaccard >= 0.4 || isSubstring) {
          const confidence = (jaccard >= 0.65 || (isSubstring && Math.abs(p1.words.length - p2.words.length) <= 1)) ? "high" : "medium";
          if (!processed.has(key)) {
            processed.add(key);
            duplicates.push({ rm1: p1.rm, rm2: p2.rm, confidence });
          }
        }
      }
    }
    return duplicates;
  }, [rawMaterials, ignoredDuplicates]);

  const normalizedSearchQuery = React.useMemo(() => {
    return removeDiacritics(searchRmQuery).trim().toUpperCase();
  }, [searchRmQuery]);

  const sortedAndFilteredRawMaterials = React.useMemo(() => {
    return [...rawMaterials]
      .sort((a, b) => a.name.localeCompare(b.name, "ro"))
      .filter(rm => {
        if (normalizedSearchQuery) {
          const normalizedRmName = removeDiacritics(rm.name).toUpperCase();
          if (!normalizedRmName.includes(normalizedSearchQuery)) {
            return false;
          }
        }
        if (selectedRmLetter !== "ALL") {
          const firstChar = removeDiacritics(rm.name).charAt(0).toUpperCase();
          return firstChar === selectedRmLetter;
        }
        return true;
      });
  }, [rawMaterials, normalizedSearchQuery, selectedRmLetter]);

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

      {/* Confirmation Modal for Resetting App */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Resetare Completă Date</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Sigur dorești să resetezi complet aplicația <strong>4Friends Margin</strong>? <br />
              Toate ingredientele (materiile prime), rețetele create, istoricul de vânzări și alertele de preț vor fi șterse definitiv. Această acțiune este ireversibilă!
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Anulează
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  performResetAllData();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-rose-100 transition-all cursor-pointer"
              >
                Da, șterge tot definitiv
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Reusable Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{confirmDialog.title}</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  confirmDialog.onConfirm();
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-amber-100 transition-all cursor-pointer"
              >
                Confirmă
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay pentru analiză rețetă PDF */}
      {isRecipeParsing && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center z-[100] p-4 animate-fade-in no-print">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-100 flex flex-col items-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 animate-bounce">
              <Sparkles className="w-8 h-8 text-indigo-600 animate-pulse" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-1">Se analizează rețeta...</h3>
            <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
              Gemini citește fișierul PDF, extrage numărul de calorii, alergenii și convertește automat ingredientele în unități de măsură standardizate (kg/litri).
            </p>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-bold text-slate-600">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
              <span>Se procesează documentul PDF cu Gemini AI</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Rețetă PDF & Mapping */}
      {showRecipeImportModal && parsedRecipe && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 flex flex-col my-8 max-h-[90vh]">
            <div className="flex items-center justify-between mb-4 shrink-0 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 text-indigo-600">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Asistent Import Rețetă PDF (Gemini AI)
                  </h3>
                  <p className="text-[11px] text-slate-500">Mapează ingredientele extrase și salvează rețeta finită.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRecipeImportModal(false);
                  setParsedRecipe(null);
                  setRecipeIngredientMappings([]);
                }}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content area scrollable */}
            <div className="space-y-5 overflow-y-auto pr-1 py-1 flex-1">
              
              {/* Product Basic Info Row */}
              <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100/60 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">Nume Produs Finit</label>
                  <input
                    type="text"
                    value={parsedRecipe.productName}
                    onChange={(e) => setParsedRecipe({ ...parsedRecipe, productName: e.target.value })}
                    className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-indigo-950 focus:outline-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">⚡ Calorii (kcal)</label>
                  <input
                    type="number"
                    value={parsedRecipe.calories || ""}
                    onChange={(e) => setParsedRecipe({ ...parsedRecipe, calories: parseInt(e.target.value) || undefined })}
                    placeholder="Ex: 350"
                    className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">Alergeni (separați prin virgulă)</label>
                  <input
                    type="text"
                    value={parsedRecipe.allergens ? parsedRecipe.allergens.join(", ") : ""}
                    onChange={(e) => setParsedRecipe({ 
                      ...parsedRecipe, 
                      allergens: e.target.value.split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
                    })}
                    placeholder="Ex: Gluten, Lactoza, Oua"
                    className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Ingredients Mapping Header */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Mapează Ingredientele Detectate ({recipeIngredientMappings.length})
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Asociați fiecare ingredient extras din PDF cu o materie primă existentă din catalog sau creați una nouă pe loc.
                </p>
              </div>

              {/* Mapping Rows */}
              <div className="space-y-3.5">
                {recipeIngredientMappings.map((mapping, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 hover:border-slate-300 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5 pb-2 border-b border-slate-200/40">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                          📌 {mapping.name}
                          {mapping.notes && (
                            <span className="text-[10px] font-normal text-slate-500 italic lowercase bg-slate-100 px-1.5 py-0.5 rounded">
                              ({mapping.notes})
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-600 mt-0.5">
                          Cantitate necesară estimată: {mapping.quantityNeeded} {mapping.unit}
                        </span>
                      </div>

                      {/* Mapping option selector */}
                      <div className="w-full sm:w-64">
                        <select
                          value={mapping.matchType === "existing" ? mapping.existingMaterialId : "new"}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "new") {
                              handleMappingRowChange(idx, "matchType", "new");
                              handleMappingRowChange(idx, "existingMaterialId", "");
                            } else {
                              handleMappingRowChange(idx, "matchType", "existing");
                              handleMappingRowChange(idx, "existingMaterialId", val);
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold focus:outline-indigo-600"
                        >
                          <option value="new">🆕 Creează materie primă nouă...</option>
                          <option disabled>── Materii prime existente ──</option>
                          {[...rawMaterials].sort((a, b) => a.name.localeCompare(b.name, "ro")).map((rm) => (
                            <option key={rm.id} value={rm.id}>
                              {rm.name} ({rm.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Inline parameters for NEW material */}
                    {mapping.matchType === "new" && (
                      <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-fade-in">
                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-600 uppercase mb-0.5">Denumire în Catalog</label>
                          <input
                            type="text"
                            value={mapping.newRmName}
                            onChange={(e) => handleMappingRowChange(idx, "newRmName", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] font-bold text-slate-800 uppercase focus:outline-indigo-600"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-600 uppercase mb-0.5">U.M. standard</label>
                          <select
                            value={mapping.newRmUnit}
                            onChange={(e) => {
                              handleMappingRowChange(idx, "newRmUnit", e.target.value);
                              handleMappingRowChange(idx, "unit", e.target.value);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-md p-1 text-[11px] font-semibold focus:outline-indigo-600"
                          >
                            <option value="kg">kg</option>
                            <option value="l">l (litru)</option>
                            <option value="buc">buc (bucată)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-600 uppercase mb-0.5">Preț Achiziție / U.M. (Fără TVA)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.0001"
                              value={mapping.newRmPrice}
                              onChange={(e) => handleMappingRowChange(idx, "newRmPrice", e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 pr-8 text-[11px] font-mono text-right font-bold text-slate-700 focus:outline-indigo-600"
                              required
                            />
                            <div className="absolute right-2 top-1 text-[10px] text-slate-400 font-extrabold">RON</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer with action buttons */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowRecipeImportModal(false);
                  setParsedRecipe(null);
                  setRecipeIngredientMappings([]);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                Abandonează
              </button>
              <button
                type="button"
                onClick={handleFinalizeRecipeImport}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-lg shadow-indigo-100 transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] duration-150"
              >
                <Check className="w-4 h-4" />
                <span>Creează Rețetă & Catalog</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Unificare / Deduplicare Materii Prime */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 text-indigo-600">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                  <GitMerge className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Unificare Materii Prime (Deduplicare)
                  </h3>
                  <p className="text-[11px] text-slate-500">Mutați rețetele de pe un ingredient duplicat pe cel corect.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMergeModal(false);
                  setMergeSourceId("");
                  setMergeTargetId("");
                }}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-100/60">
                <p className="text-xs text-indigo-950 font-medium leading-relaxed">
                  💡 <strong>Cum funcționează?</strong> Dacă aveți ingrediente introduse greșit sau sub mai multe denumiri (de ex: <em>"PIEPT PUI"</em>, <em>"PIEPT DE PUI DEZOSAT"</em>), le puteți unifica aici:
                </p>
                <ul className="text-[11px] text-indigo-950/80 list-disc list-inside mt-2 space-y-1">
                  <li>Toate produsele/rețetele care folosesc ingredientul duplicat vor fi actualizate automat să folosească ingredientul corect.</li>
                  <li>Cantitățile din rețete vor fi calculate corect în funcție de noua materie primă.</li>
                  <li>Ingredientul duplicat va fi șters automat din catalog pentru a nu mai crea confuzie.</li>
                </ul>
              </div>

              {/* Sugestii inteligente de unificare rapidă */}
              {(() => {
                const duplicates = possibleDuplicates;
                if (duplicates.length === 0) return null;
                return (
                  <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3">
                    <span className="block text-[10px] font-extrabold text-amber-800 uppercase mb-2">
                      ⭐ Sugestii de unificare rapidă (Apasă pe una):
                    </span>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {duplicates.map((pair, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            // Pre-fill the duplicate pair
                            setMergeSourceId(pair.rm1.id);
                            setMergeTargetId(pair.rm2.id);
                          }}
                          className={`border p-2 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            mergeSourceId === pair.rm1.id && mergeTargetId === pair.rm2.id
                              ? "bg-amber-100 border-amber-300 shadow-sm"
                              : "bg-white hover:bg-amber-100 border-amber-100"
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-800 truncate block max-w-[140px] sm:max-w-[170px]">{pair.rm1.name}</span>
                              <span className="text-slate-400 font-extrabold text-[10px]">→</span>
                              <span className="font-bold text-indigo-700 truncate block max-w-[140px] sm:max-w-[170px]">{pair.rm2.name}</span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">
                              Prețuri: {formatRON(pair.rm1.purchasePriceBeforeVat)} vs {formatRON(pair.rm2.purchasePriceBeforeVat)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-md hover:bg-indigo-100 transition-colors">
                              Alege
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const pairKey = [pair.rm1.id, pair.rm2.id].sort().join("-");
                                setIgnoredDuplicates(prev => [...prev, pairKey]);
                                triggerToast(`Am marcat produsele ca fiind diferite.`);
                              }}
                              className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 font-extrabold px-1.5 py-0.5 rounded-md hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
                              title="Sunt produse diferite, nu duplicate"
                            >
                              Sunt diferite
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Source ingredient dropdown */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                  1. Alege ingredientul duplicat / incorect (Care va fi ȘTERS):
                </label>
                <select
                  value={mergeSourceId}
                  onChange={(e) => {
                    setMergeSourceId(e.target.value);
                    if (e.target.value === mergeTargetId) {
                      setMergeTargetId("");
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-indigo-600"
                >
                  <option value="">Alege ingredientul pe care vrei să îl elimini...</option>
                  {[...rawMaterials].sort((a, b) => a.name.localeCompare(b.name, "ro")).map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.name} ({formatRON(rm.purchasePriceBeforeVat)}/{rm.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Swap Button */}
              {mergeSourceId && mergeTargetId && (
                <div className="flex justify-center -my-2">
                  <button
                    type="button"
                    onClick={() => {
                      const temp = mergeSourceId;
                      setMergeSourceId(mergeTargetId);
                      setMergeTargetId(temp);
                    }}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1 shadow-xs transition-all cursor-pointer active:scale-95 hover:scale-[1.02]"
                    title="Inversează direcția de unificare"
                  >
                    🔄 Inversează direcția (Păstrează celălalt)
                  </button>
                </div>
              )}

              {/* Target ingredient dropdown */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                  2. Alege ingredientul principal / corect (Pe care îl PĂSTREZI):
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-indigo-600"
                  disabled={!mergeSourceId}
                >
                  <option value="">Alege ingredientul corect cu prețul bun...</option>
                  {[...rawMaterials]
                    .filter((rm) => rm.id !== mergeSourceId)
                    .sort((a, b) => a.name.localeCompare(b.name, "ro"))
                    .map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({formatRON(rm.purchasePriceBeforeVat)}/{rm.unit})
                      </option>
                    ))}
                </select>
              </div>

              {/* Diagnostic Info Section */}
              {mergeSourceId && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-600 space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>Rețete active afectate:</span>
                    <span className="font-bold text-indigo-700">
                      {products.filter((p) => p.recipeItems.some((item) => item.rawMaterialId === mergeSourceId)).length} rețete
                    </span>
                  </div>
                  {mergeTargetId && (
                    <>
                      <div className="flex justify-between font-medium border-t border-slate-200/60 pt-1.5">
                        <span>Preț vechi (duplicat):</span>
                        <span className="font-mono text-slate-500">
                          {formatRON(rawMaterials.find((r) => r.id === mergeSourceId)?.purchasePriceBeforeVat || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Preț nou (corect):</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {formatRON(rawMaterials.find((r) => r.id === mergeTargetId)?.purchasePriceBeforeVat || 0)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowMergeModal(false);
                  setMergeSourceId("");
                  setMergeTargetId("");
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleMergeRawMaterials}
                disabled={!mergeSourceId || !mergeTargetId}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold px-5 py-2 rounded-xl shadow-lg shadow-indigo-100 transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] duration-150"
              >
                <Check className="w-4 h-4" />
                <span>Unifică Ingredientele</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal adăugare Materie Primă */}
      {showRawMaterialModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-emerald-600">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRmId ? "Editează Materie Primă" : "Adaugă Materie Primă Nouă"}
                  </h3>
                  <p className="text-[11px] text-slate-500">Aceasta va deveni disponibilă în lista de ingrediente pentru rețete.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRawMaterialModal(false);
                  setEditingRmId(null);
                  setNewRmName("");
                  setNewRmPrice("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRawMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Denumire Ingredient / Materie Primă</label>
                <input
                  type="text"
                  value={newRmName}
                  onChange={(e) => setNewRmName(e.target.value)}
                  placeholder="Ex: Făină superioară, Ouă, Unt 82%"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium focus:outline-indigo-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Unitate de Măsură (U.M.)</label>
                  <select
                    value={newRmUnit}
                    onChange={(e) => setNewRmUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium focus:outline-indigo-600"
                  >
                    <option value="kg">kg</option>
                    <option value="l">litru (l)</option>
                    <option value="buc">bucată (buc)</option>
                    <option value="m">metru (m)</option>
                    <option value="g">gram (g)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Procent TVA (%)</label>
                  <select
                    value={newRmVat}
                    onChange={(e) => setNewRmVat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium focus:outline-indigo-600"
                  >
                    <option value="11">TVA Alimente / Redus (11%)</option>
                    <option value="21">TVA Standard / Non-alimente (21%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Preț de Achiziție (Fără TVA) per U.M.</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    value={newRmPrice}
                    onChange={(e) => setNewRmPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pr-12 text-xs font-mono text-right font-semibold text-slate-800 focus:outline-indigo-600"
                    required
                  />
                  <div className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">RON</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRawMaterialModal(false);
                    setEditingRmId(null);
                    setNewRmName("");
                    setNewRmPrice("");
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-100 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingRmId ? "Actualizează Ingredient" : "Adaugă Ingredient"}</span>
                </button>
              </div>
            </form>
          </div>
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
            <Database className="w-5 h-5 text-indigo-400" />
            <span>Materii Prime & SPV</span>
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
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2 font-bold">Status Conexiune ANAF</p>
            {anafConnected ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-xs text-emerald-400 font-bold">SPV Conectat</span>
                </div>
                <p className="text-[10px] text-slate-300 truncate font-semibold mt-1" title={anafCompany}>{anafCompany}</p>
                <p className="text-[9px] text-slate-400">CIF: {anafCif}</p>
                <button
                  onClick={handleDisconnectAnaf}
                  className="mt-2 text-left text-[9px] text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                >
                  Deconectează cont
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
                  <span className="text-xs text-slate-400 font-medium">SPV Deconectat</span>
                </div>
                <button 
                  onClick={handleConnectAnaf}
                  className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1.5 px-2 rounded-lg transition-colors cursor-pointer text-center"
                >
                  Conectează OAuth
                </button>
              </div>
            )}
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
            <button
              onClick={handleResetAllData}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-rose-100/50 active:scale-95 active:text-rose-900 duration-150"
              title="Resetează complet aplicația și șterge toate datele din catalog și vânzări"
            >
              <Trash2 className="w-3.5 h-3.5 animate-pulse" />
              <span>Resetare Date (Aplicație Golită)</span>
            </button>
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
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Produse Finale & Rețete</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Selectați un produs pentru a-i vedea formula</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={recipeFileInputRef}
                    onChange={handleRecipePdfSelected}
                    accept=".pdf"
                    className="hidden"
                  />
                  <button
                    onClick={() => {
                      setEditingRmId(null);
                      setNewRmName("");
                      setNewRmPrice("");
                      setNewRmUnit("kg");
                      setNewRmVat("11");
                      setShowRawMaterialModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md shadow-emerald-200 transition-all cursor-pointer whitespace-nowrap active:scale-95 duration-100"
                    title="Adaugă materie primă sau ingredient nou în catalog"
                  >
                    <Plus className="w-3.5 h-3.5" /> Materie Primă
                  </button>
                  <button
                    onClick={() => recipeFileInputRef.current?.click()}
                    disabled={isRecipeParsing}
                    className="bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 border border-indigo-200 transition-all cursor-pointer whitespace-nowrap active:scale-95 duration-100 disabled:opacity-50"
                    title="Încarcă rețetă din fișier PDF folosind AI (Gemini)"
                  >
                    {isRecipeParsing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Importă Rețetă</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingProductId(null);
                      setNewProdName("");
                      setNewProdLogistics("0");
                      setNewProdTaxes("0");
                      setNewProdMargin("20");
                      setNewProdVat("11");
                      setNewProdRecipe([{ rawMaterialId: "", quantityNeeded: 0 }]);
                      setShowProductForm(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md shadow-indigo-200 transition-all cursor-pointer whitespace-nowrap active:scale-95 duration-100"
                    title="Adaugă un produs final sau o rețetă nouă"
                  >
                    <Plus className="w-3.5 h-3.5" /> Produs
                  </button>
                </div>
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRmId(null);
                              setNewRmName("");
                              setNewRmPrice("");
                              setNewRmUnit("kg");
                              setNewRmVat("11");
                              setShowRawMaterialModal(true);
                            }}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5"
                            title="Creează o materie primă nouă în catalogul global"
                          >
                            <Plus className="w-3 h-3" /> Creează Ingredient Nou
                          </button>
                          <span className="text-slate-300 text-xs">|</span>
                          <button
                            type="button"
                            onClick={handleAddRecipeRow}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                            title="Adaugă un nou rând pentru ingredient în această rețetă"
                          >
                            <Plus className="w-3 h-3" /> Adaugă rând în rețetă
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {newProdRecipe.map((recipeItem, index) => {
                          const selectedRm = rawMaterials.find((rm) => rm.id === recipeItem.rawMaterialId);
                          const unitLabel = selectedRm ? getRecipeItemUnit(selectedRm.unit) : "";
                          
                          return (
                            <div key={index} className="flex items-center gap-1.5">
                              <select
                                value={recipeItem.rawMaterialId}
                                onChange={(e) => handleRecipeRowChange(index, "rawMaterialId", e.target.value)}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-md p-1 text-[11px] font-medium focus:outline-indigo-600"
                                required
                              >
                                <option value="">Alege ingredient...</option>
                                {[...rawMaterials].sort((a, b) => a.name.localeCompare(b.name, "ro")).map((rm) => (
                                  <option key={rm.id} value={rm.id}>
                                    {rm.name} ({formatRON(rm.purchasePriceBeforeVat)}/{rm.unit})
                                  </option>
                                ))}
                              </select>
                              <div className="relative flex items-center shrink-0">
                                <input
                                  type="number"
                                  step="any"
                                  value={recipeItem.quantityNeeded || ""}
                                  onChange={(e) => handleRecipeRowChange(index, "quantityNeeded", e.target.value)}
                                  placeholder="Cant."
                                  className="w-24 bg-slate-50 border border-slate-200 rounded-md py-1 pl-1.5 pr-7 text-[11px] font-mono text-right focus:outline-indigo-600"
                                  required
                                />
                                {unitLabel && (
                                  <span className="absolute right-1.5 text-[9px] font-extrabold text-indigo-600 bg-indigo-50/80 px-1 py-0.5 rounded pointer-events-none uppercase">
                                    {unitLabel}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveRecipeRow(index)}
                                className="text-rose-500 hover:text-rose-700 p-1 shrink-0"
                                disabled={newProdRecipe.length === 1}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
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
                          <option value="11">11% (Alimente / Platouri)</option>
                          <option value="21">21% (Non-alimente / Altele)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                          ⚡ Calorii (kcal)
                        </label>
                        <input
                          type="number"
                          placeholder="Ex: 350"
                          value={newProdCalories}
                          onChange={(e) => setNewProdCalories(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono text-right focus:outline-indigo-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                          Alergeni (separați prin virgulă)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Gluten, Lactoza, Oua"
                          value={newProdAllergens}
                          onChange={(e) => setNewProdAllergens(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-indigo-600"
                        />
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
                        {(activeProduct.calories !== undefined || (activeProduct.allergens && activeProduct.allergens.length > 0)) && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {activeProduct.calories !== undefined && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                ⚡ {activeProduct.calories} kcal
                              </span>
                            )}
                            {activeProduct.allergens && activeProduct.allergens.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-[10px] font-bold text-slate-400 mr-1 uppercase">Alergeni:</span>
                                {activeProduct.allergens.map((alg) => (
                                  <span key={alg} className="bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                                    {alg}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
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
                            const factor = getRecipeItemFactor(rm.unit);
                            const totalCost = (item.quantityNeeded / factor) * rm.purchasePriceBeforeVat;

                            return (
                              <tr key={index} className="hover:bg-slate-50/50">
                                <td className="p-2.5 font-semibold text-slate-900">{rm.name}</td>
                                <td className="p-2.5 font-mono text-right text-slate-500">
                                  {formatRON(rm.purchasePriceBeforeVat)} / {rm.unit}
                                </td>
                                <td className="p-2.5 font-mono text-right text-slate-900 font-medium">
                                  {item.quantityNeeded} {getRecipeItemUnit(rm.unit)}
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
          <div className="space-y-6">
            
            {/* Propuneri inteligente de unificare (Deduplicare automată) */}
            {(() => {
              const duplicates = possibleDuplicates;
              if (duplicates.length === 0) return null;
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4.5 shadow-xs animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 text-amber-600">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-900 text-xs sm:text-sm flex items-center gap-1.5 uppercase">
                        🔍 Detectare automată duplicate ({duplicates.length})
                      </h4>
                      <p className="text-[11px] text-amber-800 font-semibold mt-1 leading-relaxed">
                        Am găsit ingrediente similare care par să fie duplicate în catalog (ex: <em className="underline font-bold text-amber-950">{duplicates[0].rm1.name}</em> și <em className="underline font-bold text-amber-950">{duplicates[0].rm2.name}</em>). Unifică-le pentru a avea un calcul corect al costurilor!
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const pair = duplicates[0];
                        setMergeSourceId(pair.rm1.id);
                        setMergeTargetId(pair.rm2.id);
                        setShowMergeModal(true);
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-extrabold px-3 py-2 rounded-lg shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                      Unifică-le acum
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pair = duplicates[0];
                        const pairKey = [pair.rm1.id, pair.rm2.id].sort().join("-");
                        setIgnoredDuplicates(prev => [...prev, pairKey]);
                        triggerToast(`Am marcat "${pair.rm1.name}" și "${pair.rm2.name}" ca fiind produse diferite.`);
                      }}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                      Sunt diferite (Ignoră)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMergeModal(true);
                      }}
                      className="bg-white hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                      Vezi toate duplicatele
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
            
            {/* Raw materials inventory list (col-span-5) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Catalog Materii Prime</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Prețurile curente stabilite în rețete</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMergeModal(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  title="Unifică materiale scrise sub diferite denumiri într-unul singur"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Unifică duplicate</span>
                </button>
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
                        <option value="21">21% (Non-alimente / Altele)</option>
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

              {/* Quick Search & A-Z Index Panel */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/40 space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchRmQuery}
                    onChange={(e) => setSearchRmQuery(e.target.value)}
                    placeholder="Caută după denumire (ex: SALAM)..."
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 text-xs font-semibold focus:outline-indigo-600 uppercase"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  {searchRmQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchRmQuery("")}
                      className="text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-100"
                    >
                      ×
                    </button>
                  )}
                </div>
                
                {/* Alphabetical Quick Index Navigation */}
                <div className="flex flex-wrap gap-1 items-center pt-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Litera:</span>
                  {["ALL", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "V", "X", "Z"].map((letter) => {
                    const isSelected = selectedRmLetter === letter;
                    return (
                      <button
                        type="button"
                        key={letter}
                        onClick={() => setSelectedRmLetter(letter)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-xs shadow-indigo-100 scale-105"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-950"
                        }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inventory Table List */}
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1 max-h-[450px]">
                {sortedAndFilteredRawMaterials.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-semibold bg-white">
                    Nu s-au găsit materii prime potrivite pentru selecția curentă.
                  </div>
                ) : (
                  sortedAndFilteredRawMaterials.map((rm) => (
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
                        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMergeSourceId(rm.id);
                              setShowMergeModal(true);
                            }}
                            className="p-1 hover:bg-slate-100 rounded-md text-indigo-600"
                            title="Unifică sau deduplicează acest ingredient"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditRm(rm)}
                            className="p-1 hover:bg-slate-100 rounded-md text-slate-600"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRm(rm.id, rm.name)}
                            className="p-1 hover:bg-slate-100 rounded-md text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
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

                  {/* MULTIPLE ZIP ARCHIVES UPLOADER */}
                  <div className="bg-slate-50/70 p-4 rounded-xl border border-dashed border-slate-200 hover:border-indigo-400 transition-all flex flex-col items-center justify-between text-center group">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl group-hover:scale-105 transition-all">
                      <FileArchive className="w-6 h-6" />
                    </div>
                    <div className="mt-3">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Arhive Multiple .ZIP (ANAF)</h4>
                      <p className="text-[11px] text-slate-500 leading-normal max-w-xs mx-auto mt-1">
                        Selectați unul sau mai multe fișiere .ZIP cu facturi descărcate din ANAF. Extragere automată a tuturor XML-urilor.
                      </p>
                    </div>
                    
                    <div className="flex gap-2 mt-4 flex-wrap justify-center">
                      <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer shadow-md shadow-indigo-100 transition-all flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        Alege Arhive .ZIP
                        <input
                          type="file"
                          accept=".zip"
                          multiple
                          onChange={handleZipUpload}
                          className="hidden"
                        />
                      </label>
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

                {/* ANAF SPV OAuth 2.0 Integration Panel */}
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden shadow-lg border border-slate-800">
                    <div className="absolute right-0 bottom-0 translate-y-1/3 translate-x-1/4 opacity-10">
                      <Database className="w-48 h-48 text-indigo-500" />
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-950/60 text-yellow-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-500/30">
                            ANAF SPV OAuth 2.0
                          </span>
                          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-emerald-500/20">
                            API v1.0
                          </span>
                        </div>
                        
                        {anafConnected && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/40 font-semibold">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span>Sincronizat activ</span>
                          </div>
                        )}
                      </div>

                      <h4 className="font-bold text-sm sm:text-base text-white">
                        Sincronizare Automată ANAF SPV (e-Factura)
                      </h4>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-xl">
                        Conectați-vă contul SPV prin OAuth 2.0 securizat. Facturile primite de la furnizorii de materii prime vor fi preluate automat în timp real, direct în format XML UBL securizat, iar prețurile din rețete vor fi verificate instantaneu!
                      </p>

                      {/* Connection details block */}
                      {anafConnected ? (
                        <div className="mt-4 bg-slate-800/30 rounded-xl p-4 border border-slate-800 text-xs max-w-xl">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Firmă Conectată</span>
                              <p className="font-bold text-slate-200">{anafCompany}</p>
                              <p className="text-[10px] text-slate-400 font-mono">CIF: {anafCif}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Token Valabilitate (OAuth)</span>
                              <p className="font-semibold text-emerald-400">Activ (90 de zile)</p>
                              <p className="text-[10px] text-slate-400">Expiră la: {anafExpiresAt}</p>
                            </div>
                          </div>
                          
                          <div className="mt-4 pt-3.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                            <button
                              onClick={handleSyncAnaf}
                              disabled={isScanning}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md shadow-indigo-900 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                              Sincronizează facturi SPV
                            </button>
                            <button
                              onClick={handleDisconnectAnaf}
                              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                            >
                              Deconectează contul ANAF
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4">
                          <button
                            onClick={handleConnectAnaf}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-md shadow-indigo-950 transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <Database className="w-4 h-4 text-indigo-300" />
                            Conectează contul ANAF SPV via OAuth
                          </button>
                          
                          {/* Instructions block */}
                          <div className="mt-4 bg-slate-950/40 rounded-xl p-3.5 border border-slate-800 text-[11px] text-slate-400 leading-relaxed max-w-xl">
                            <p className="font-semibold text-slate-300 text-xs mb-1">📋 Ghid de configurare OAuth:</p>
                            <ul className="list-disc pl-4 space-y-1 text-slate-400">
                              <li>Dacă doriți doar testarea aplicației, lăsați setările implicite în portalul pop-up și conectați-vă în modul <strong>Sandbox</strong> pentru a descărca imediat facturi virtuale.</li>
                              <li>Pentru producție reală, înregistrați aplicația în portalul ANAF OAuth API și adăugați variabila <code>ANAF_CLIENT_ID</code> în setările aplicației (.env).</li>
                              <li>Adresă URL de callback autorizată în portalul ANAF:</li>
                              <li className="list-none pt-1">
                                <code className="bg-slate-950 p-1.5 rounded font-mono text-[10px] text-indigo-300 block select-all overflow-x-auto whitespace-nowrap">https://ais-dev-hxglmedpfxrn4g2l6wx5dj-549539269193.europe-west2.run.app/api/auth/anaf/callback</code>
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Simulated Supplier Invoices Quick Selector */}
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                    Instrumente de Testare: Simulare Livrări & Actualizări Prețuri Furnizori
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSimulateSPV(0)}
                      className="bg-white border border-slate-200 hover:border-indigo-500 p-2.5 rounded-xl hover:bg-indigo-50/30 text-left transition-all group flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="block font-bold text-xs text-slate-800">Carmangeria Popescu</span>
                        <span className="block text-[9px] text-slate-500">Piept pui & Ceafă (Scumpiri/Ieftiniri)</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    
                    <button
                      onClick={() => handleSimulateSPV(1)}
                      className="bg-white border border-slate-200 hover:border-indigo-500 p-2.5 rounded-xl hover:bg-indigo-50/30 text-left transition-all group flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="block font-bold text-xs text-slate-800">Metro Cash & Carry</span>
                        <span className="block text-[9px] text-slate-500">Legume, Ulei, Castraveți (Import)</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    <button
                      onClick={() => handleSimulateSPV(2)}
                      className="bg-white border border-slate-200 hover:border-indigo-500 p-2.5 rounded-xl hover:bg-indigo-50/30 text-left transition-all group flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="block font-bold text-xs text-slate-800">Ambalaje HoReCa Distrib</span>
                        <span className="block text-[9px] text-slate-500">Platouri plastic (Crește la 3.90 RON)</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>

              </div>

              {/* Coada de Facturi Importate */}
              {uploadedInvoicesQueue.length > 0 && (
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl border border-slate-800 mb-6 animate-fade-in">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <FileArchive className="w-5 h-5 text-indigo-400" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">Coada de Facturi Importate ({uploadedInvoicesQueue.length})</h3>
                        <p className="text-[10px] text-slate-400 font-medium">Puteți selecta factura pe care doriți să o asociați cu catalogul</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setUploadedInvoicesQueue([]);
                        setScannedInvoiceResult(null);
                        setInvoiceMappings(null);
                      }}
                      className="text-[10px] bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      Golește Coada
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-1">
                    {uploadedInvoicesQueue.map((invoice) => {
                      const isActive = scannedInvoiceResult?.id === invoice.id;
                      const isApplied = invoice.status === "applied";
                      return (
                        <button
                          key={invoice.id}
                          onClick={() => {
                            if (isApplied) {
                              triggerToast("Această factură a fost deja aplicată cu succes!", "info");
                            }
                            setScannedInvoiceResult(invoice);
                            runIntelligentInvoiceMapping(invoice);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between h-24 cursor-pointer ${
                            isActive
                              ? "bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/30 text-white"
                              : isApplied
                              ? "bg-emerald-950/40 border-emerald-900/60 text-slate-300 opacity-75 hover:opacity-100"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]" title={invoice.invoiceNumber}>
                                {invoice.invoiceNumber}
                              </span>
                              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                isApplied
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : isActive
                                  ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 animate-pulse"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}>
                                {isApplied ? "APLICATĂ" : isActive ? "MAPPING..." : "AȘTEPTARE"}
                              </span>
                            </div>
                            <p className="font-bold text-xs truncate mt-1 text-slate-100" title={invoice.supplierName}>
                              {invoice.supplierName}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 border-t border-slate-800/50 pt-1.5">
                            <span>{invoice.invoiceDate}</span>
                            <span>{invoice.items.length} prod.</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scanned invoice preview results & Intelligent AI Mapping */}
              {scannedInvoiceResult && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                        Semantizare Factură SPV (Asistent AI Gemini)
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">Mapare automată flexibilă și inteligentă a produselor achiziționate</p>
                    </div>
                    <button
                      onClick={() => {
                        setScannedInvoiceResult(null);
                        setInvoiceMappings(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      Ascunde
                    </button>
                  </div>

                  {/* Factura Metadata Header */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl text-xs">
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">FURNIZOR</span>
                      <strong className="text-slate-900 text-sm">{scannedInvoiceResult.supplierName}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">NR. FACTURĂ</span>
                      <strong className="text-slate-900 text-sm font-mono">{scannedInvoiceResult.invoiceNumber}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">DATĂ EMITERE</span>
                      <strong className="text-slate-900 text-sm">{scannedInvoiceResult.invoiceDate}</strong>
                    </div>
                  </div>

                  {/* Mapping Loading State */}
                  {isMappingInvoice && (
                    <div className="bg-slate-50 border border-indigo-100 p-8 rounded-xl text-center space-y-3">
                      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                      <p className="text-xs text-indigo-950 font-bold animate-pulse">Inteligenta Artificială Gemini asociază produsele...</p>
                      <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
                        Se elimină abrevierile producătorului, se normalizează denumirile, se asociază semantizarea cu catalogul existent (ex: "piept dezosat" în "piept de pui") și se depistează diferențele de preț.
                      </p>
                    </div>
                  )}

                  {/* Mapping Display & Editor */}
                  {!isMappingInvoice && invoiceMappings && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-700">Articole detectate în factură și propuneri de salvare:</div>
                      
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white">
                        {invoiceMappings.map((map, index) => {
                          const isNew = map.matchType === "new" || !map.existingMaterialId;
                          const existingRm = isNew ? null : rawMaterials.find(rm => rm.id === map.existingMaterialId);
                          
                          // Calculate price diff
                          let diffElement = null;
                          if (existingRm) {
                            const oldP = existingRm.purchasePriceBeforeVat;
                            const newP = map.unitPriceBeforeVat;
                            const diff = newP - oldP;
                            if (Math.abs(diff) > 0.01) {
                              const percent = ((diff / oldP) * 100).toFixed(1);
                              if (diff > 0) {
                                diffElement = (
                                  <span className="text-[10px] bg-rose-50 text-rose-700 font-extrabold px-2 py-0.5 rounded-full border border-rose-100 animate-pulse">
                                    ↑ Scumpire (+{percent}%)
                                  </span>
                                );
                              } else {
                                diffElement = (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full border border-emerald-100">
                                    ↓ Ieftinire ({percent}%)
                                  </span>
                                );
                              }
                            } else {
                              diffElement = (
                                <span className="text-[10px] bg-slate-50 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-100">
                                  = Preț stabil
                                </span>
                              );
                            }
                          } else {
                            diffElement = (
                              <span className="text-[10px] bg-amber-50 text-amber-700 font-extrabold px-2 py-0.5 rounded-full border border-amber-100">
                                + Materie Primă Nouă
                              </span>
                            );
                          }

                          return (
                            <div key={index} className="p-4 hover:bg-slate-50/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                              
                              {/* Left side: Invoice item details */}
                              <div className="space-y-1.5 max-w-sm">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Item pe Factură</div>
                                <div className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">{map.originalName}</div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                  <span>Cantitate:</span>
                                  <span className="font-mono text-slate-800 font-bold">{map.quantity} {map.unitOfMeasure}</span>
                                  <span className="text-slate-300">|</span>
                                  <span>Preț achiziție:</span>
                                  <span className="font-mono text-indigo-600 font-extrabold">{formatRON(map.unitPriceBeforeVat)}</span>
                                </div>
                              </div>

                              {/* Center: Mapping selector & Input */}
                              <div className="flex-1 max-w-md space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mapare în Catalogul tău</span>
                                  {diffElement}
                                </div>

                                <div className="flex items-center gap-2">
                                  {isNew ? (
                                    <div className="flex-1">
                                      <input
                                        type="text"
                                        value={map.suggestedCleanName}
                                        onChange={(e) => {
                                          const updated = [...invoiceMappings];
                                          updated[index].suggestedCleanName = e.target.value;
                                          setInvoiceMappings(updated);
                                        }}
                                        className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 transition-all"
                                        placeholder="Introduceți denumirea curată..."
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex-1 flex items-center justify-between bg-emerald-50/40 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                                      <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                        {existingRm?.name}
                                      </span>
                                      <span className="text-[9px] text-slate-400 font-bold uppercase">Preț actual: {formatRON(existingRm?.purchasePriceBeforeVat || 0)}</span>
                                    </div>
                                  )}

                                  {/* UOM Selector */}
                                  <div className="w-20">
                                    <select
                                      value={map.unit || "kg"}
                                      onChange={(e) => {
                                        const updated = [...invoiceMappings];
                                        updated[index].unit = e.target.value;
                                        setInvoiceMappings(updated);
                                      }}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-indigo-500 text-center"
                                    >
                                      <option value="kg">kg</option>
                                      <option value="l">l</option>
                                      <option value="buc">buc</option>
                                      <option value="pachet">pac</option>
                                    </select>
                                  </div>
                                </div>
                              </div>

                            </div>
                          );
                        })}
                      </div>

                      {/* Map Confirmation Panel */}
                      <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs text-slate-600 font-medium">
                          <span className="font-extrabold text-indigo-950 block text-sm">Ești gata să aplici modificările?</span>
                          Se vor adăuga automat produsele noi în catalog și se vor actualiza prețurile de achiziție, recalculând automat prețurile de producție recomandate.
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => {
                              setScannedInvoiceResult(null);
                              setInvoiceMappings(null);
                              triggerToast("Importul facturii a fost anulat.", "info");
                            }}
                            className="flex-1 sm:flex-none border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                          >
                            Resetează
                          </button>
                          <button
                            onClick={() => handleApplyInvoiceMappings(scannedInvoiceResult)}
                            className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Aprobă și Actualizează Catalogul
                          </button>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

            </div>

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
