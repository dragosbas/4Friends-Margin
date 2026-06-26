export interface RawMaterial {
  id: string;
  name: string;
  unit: string; // kg, l, buc, etc.
  purchasePriceBeforeVat: number; // base purchase cost per unit
  vatPercent: number; // e.g. 19, 9, 5
  lastUpdated: string; // ISO String
}

export interface RecipeItem {
  rawMaterialId: string;
  quantityNeeded: number; // Quantity of the raw material needed for 1 unit of final product
}

export interface FinalProduct {
  id: string;
  name: string;
  recipeItems: RecipeItem[];
  logisticsCost: number; // fixed transport/packaging cost per unit (RON)
  otherTaxesCost: number; // local taxes / other cost per unit (RON)
  customMarginPercent: number; // custom profit margin (e.g. 20%)
  customVatPercent: number; // e.g. 19% VAT for the sold product
}

export interface SalePriceBreakdown {
  totalRawMaterialCost: number;
  logisticsCost: number;
  otherTaxes: number;
  productionCost: number; // raw materials + logistics + other taxes
  profitMarginAmount: number; // productionCost * marginPercent
  salePriceBeforeVat: number; // productionCost + profitMarginAmount
  vatAmount: number; // salePriceBeforeVat * customVatPercent
  finalSalePriceWithVat: number; // salePriceBeforeVat + vatAmount
}

export interface ScannedInvoiceItem {
  name: string;
  quantity: number;
  unitOfMeasure?: string;
  unitPriceBeforeVat: number;
  vatPercent: number;
  totalPriceBeforeVat?: number;
}

export interface ScannedInvoice {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  items: ScannedInvoiceItem[];
  status: "applied" | "pending";
}

export interface SaleRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  salePriceBeforeVat: number;
  salePriceWithVat: number;
  totalRevenueBeforeVat: number;
  totalRevenueWithVat: number;
  totalCost: number; // productionCost * quantity
  totalProfit: number; // totalRevenueBeforeVat - totalCost
  date: string; // YYYY-MM-DD
}

export interface PriceAlert {
  id: string;
  type: "price_increase" | "price_decrease";
  rawMaterialId: string;
  rawMaterialName: string;
  oldPrice: number;
  newPrice: number;
  invoiceNumber: string;
  supplierName: string;
  date: string;
  resolved: boolean;
}
