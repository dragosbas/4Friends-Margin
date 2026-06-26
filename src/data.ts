import { RawMaterial, FinalProduct, SaleRecord } from "./types";

export const INITIAL_RAW_MATERIALS: RawMaterial[] = [
  {
    id: "rm-1",
    name: "Făină superioară tip 000",
    unit: "kg",
    purchasePriceBeforeVat: 4.5,
    vatPercent: 11,
    lastUpdated: "2026-06-15T12:00:00Z"
  },
  {
    id: "rm-2",
    name: "Zahăr tos",
    unit: "kg",
    purchasePriceBeforeVat: 5.2,
    vatPercent: 21,
    lastUpdated: "2026-06-16T14:30:00Z"
  },
  {
    id: "rm-3",
    name: "Unt românesc 82% grăsime",
    unit: "kg",
    purchasePriceBeforeVat: 42.0,
    vatPercent: 11,
    lastUpdated: "2026-06-20T09:15:00Z"
  },
  {
    id: "rm-4",
    name: "Lapte proaspăt 3.5% grăsime",
    unit: "l",
    purchasePriceBeforeVat: 6.50,
    vatPercent: 11,
    lastUpdated: "2026-06-21T10:00:00Z"
  },
  {
    id: "rm-5",
    name: "Ambalaj cutie biodegradabilă premium",
    unit: "buc",
    purchasePriceBeforeVat: 2.50,
    vatPercent: 21,
    lastUpdated: "2026-06-22T11:45:00Z"
  }
];

export const INITIAL_PRODUCTS: FinalProduct[] = [
  {
    id: "p-1",
    name: "Cozonac Tradițional Premium (1kg)",
    recipeItems: [
      { rawMaterialId: "rm-1", quantityNeeded: 0.6 }, // 0.6 kg făină = 2.7 RON
      { rawMaterialId: "rm-2", quantityNeeded: 0.15 }, // 0.15 kg zahăr = 0.78 RON
      { rawMaterialId: "rm-3", quantityNeeded: 0.12 }, // 0.12 kg unt = 5.04 RON
      { rawMaterialId: "rm-4", quantityNeeded: 0.25 }, // 0.25 l lapte = 1.625 RON
      { rawMaterialId: "rm-5", quantityNeeded: 1.0 } // 1 ambalaj = 2.50 RON
    ], // Total Raw Materials = 12.645 RON
    logisticsCost: 3.50, // transport + manipulare
    otherTaxesCost: 1.20, // utilități + regie directă
    customMarginPercent: 35, // marjă de profit de 35%
    customVatPercent: 21 // TVA la vânzare (produs cu zahăr)
  },
  {
    id: "p-2",
    name: "Tort Diplomat cu Fructe (1.5kg)",
    recipeItems: [
      { rawMaterialId: "rm-1", quantityNeeded: 0.3 }, // 0.3 kg făină
      { rawMaterialId: "rm-2", quantityNeeded: 0.25 }, // 0.25 kg zahăr
      { rawMaterialId: "rm-3", quantityNeeded: 0.35 }, // 0.35 kg unt
      { rawMaterialId: "rm-4", quantityNeeded: 0.4 }, // 0.4 l lapte
      { rawMaterialId: "rm-5", quantityNeeded: 1.0 } // 1 ambalaj
    ],
    logisticsCost: 5.50,
    otherTaxesCost: 2.30,
    customMarginPercent: 45,
    customVatPercent: 21 // TVA la vânzare (produs cu zahăr)
  }
];

export const INITIAL_SALES: SaleRecord[] = [
  // Aprilie 2026
  {
    id: "s-1",
    productId: "p-1",
    productName: "Cozonac Tradițional Premium (1kg)",
    quantity: 80,
    salePriceBeforeVat: 23.42,
    salePriceWithVat: 25.53,
    totalRevenueBeforeVat: 1873.60,
    totalRevenueWithVat: 2042.40,
    totalCost: 1387.60, // approx cost
    totalProfit: 486.00,
    date: "2026-04-10"
  },
  {
    id: "s-2",
    productId: "p-2",
    productName: "Tort Diplomat cu Fructe (1.5kg)",
    quantity: 35,
    salePriceBeforeVat: 46.10,
    salePriceWithVat: 50.25,
    totalRevenueBeforeVat: 1613.50,
    totalRevenueWithVat: 1758.75,
    totalCost: 1113.50,
    totalProfit: 500.00,
    date: "2026-04-20"
  },
  // Mai 2026
  {
    id: "s-3",
    productId: "p-1",
    productName: "Cozonac Tradițional Premium (1kg)",
    quantity: 110,
    salePriceBeforeVat: 23.42,
    salePriceWithVat: 25.53,
    totalRevenueBeforeVat: 2576.20,
    totalRevenueWithVat: 2808.30,
    totalCost: 1907.95,
    totalProfit: 668.25,
    date: "2026-05-15"
  },
  {
    id: "s-4",
    productId: "p-2",
    productName: "Tort Diplomat cu Fructe (1.5kg)",
    quantity: 48,
    salePriceBeforeVat: 46.10,
    salePriceWithVat: 50.25,
    totalRevenueBeforeVat: 2212.80,
    totalRevenueWithVat: 2412.00,
    totalCost: 1527.36,
    totalProfit: 685.44,
    date: "2026-05-24"
  },
  // Iunie 2026 (Curent)
  {
    id: "s-5",
    productId: "p-1",
    productName: "Cozonac Tradițional Premium (1kg)",
    quantity: 145,
    salePriceBeforeVat: 23.42,
    salePriceWithVat: 25.53,
    totalRevenueBeforeVat: 3395.90,
    totalRevenueWithVat: 3701.85,
    totalCost: 2515.02,
    totalProfit: 880.88,
    date: "2026-06-05"
  },
  {
    id: "s-6",
    productId: "p-2",
    productName: "Tort Diplomat cu Fructe (1.5kg)",
    quantity: 62,
    salePriceBeforeVat: 46.10,
    salePriceWithVat: 50.25,
    totalRevenueBeforeVat: 2858.20,
    totalRevenueWithVat: 3115.50,
    totalCost: 1972.84,
    totalProfit: 885.36,
    date: "2026-06-18"
  },
  {
    id: "s-7",
    productId: "p-1",
    productName: "Cozonac Tradițional Premium (1kg)",
    quantity: 30,
    salePriceBeforeVat: 23.42,
    salePriceWithVat: 25.53,
    totalRevenueBeforeVat: 702.60,
    totalRevenueWithVat: 765.90,
    totalCost: 520.35,
    totalProfit: 182.25,
    date: "2026-06-25"
  }
];
