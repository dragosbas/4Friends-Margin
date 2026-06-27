import { RawMaterial, FinalProduct, SaleRecord } from "./types";

export const INITIAL_RAW_MATERIALS: RawMaterial[] = [
  {
    id: "rm-piept-pui",
    name: "piept de pui",
    unit: "kg",
    purchasePriceBeforeVat: 22.50,
    vatPercent: 11,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "rm-cartofi",
    name: "cartofi",
    unit: "kg",
    purchasePriceBeforeVat: 3.20,
    vatPercent: 11,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "rm-rosii",
    name: "roșii proaspete",
    unit: "kg",
    purchasePriceBeforeVat: 7.50,
    vatPercent: 11,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "rm-ceafa-porc",
    name: "ceafă de porc",
    unit: "kg",
    purchasePriceBeforeVat: 27.00,
    vatPercent: 11,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "rm-branza-telemea",
    name: "telemea de vacă",
    unit: "kg",
    purchasePriceBeforeVat: 25.00,
    vatPercent: 11,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "rm-ulei",
    name: "ulei floarea soarelui",
    unit: "l",
    purchasePriceBeforeVat: 6.50,
    vatPercent: 11,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "rm-castraveti",
    name: "castraveți proaspeți",
    unit: "kg",
    purchasePriceBeforeVat: 6.00,
    vatPercent: 11,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "rm-ambalaj",
    name: "ambalaj platou plastic premium",
    unit: "buc",
    purchasePriceBeforeVat: 3.50,
    vatPercent: 21,
    lastUpdated: new Date().toISOString()
  }
];

export const INITIAL_PRODUCTS: FinalProduct[] = [
  {
    id: "prod-grill",
    name: "Platou Cald Grill Fest (4-6 pers)",
    recipeItems: [
      { rawMaterialId: "rm-piept-pui", quantityNeeded: 0.8 },
      { rawMaterialId: "rm-ceafa-porc", quantityNeeded: 0.8 },
      { rawMaterialId: "rm-cartofi", quantityNeeded: 1.2 },
      { rawMaterialId: "rm-ulei", quantityNeeded: 0.15 },
      { rawMaterialId: "rm-ambalaj", quantityNeeded: 1.0 }
    ],
    logisticsCost: 5.0,
    otherTaxesCost: 2.0,
    customMarginPercent: 45.0,
    customVatPercent: 11.0
  },
  {
    id: "prod-traditional",
    name: "Platou Aperitiv Tradițional (4-6 pers)",
    recipeItems: [
      { rawMaterialId: "rm-branza-telemea", quantityNeeded: 0.6 },
      { rawMaterialId: "rm-rosii", quantityNeeded: 0.5 },
      { rawMaterialId: "rm-castraveti", quantityNeeded: 0.5 },
      { rawMaterialId: "rm-ambalaj", quantityNeeded: 1.0 }
    ],
    logisticsCost: 4.0,
    otherTaxesCost: 1.0,
    customMarginPercent: 40.0,
    customVatPercent: 11.0
  }
];

export const INITIAL_SALES: SaleRecord[] = [
  {
    id: "sale-1",
    productId: "prod-grill",
    productName: "Platou Cald Grill Fest (4-6 pers)",
    quantity: 5,
    salePriceBeforeVat: 110.50,
    salePriceWithVat: 120.45,
    totalRevenueBeforeVat: 552.50,
    totalRevenueWithVat: 602.25,
    totalCost: 310.00,
    totalProfit: 242.50,
    date: new Date().toISOString().split("T")[0]
  },
  {
    id: "sale-2",
    productId: "prod-traditional",
    productName: "Platou Aperitiv Tradițional (4-6 pers)",
    quantity: 3,
    salePriceBeforeVat: 68.00,
    salePriceWithVat: 74.12,
    totalRevenueBeforeVat: 204.00,
    totalRevenueWithVat: 222.36,
    totalCost: 115.00,
    totalProfit: 89.00,
    date: new Date().toISOString().split("T")[0]
  }
];
