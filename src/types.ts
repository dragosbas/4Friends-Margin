export interface RawMaterial {
  id: string;
  name: string;
  unit: string; // kg, l, buc, etc.
  purchasePriceBeforeVat: number; // base purchase cost per unit
  vatPercent: number; // e.g. 11% or 21% under July 2025 RO fiscal rules
  lastUpdated: string; // ISO String
  isPackaged?: boolean;
  packagePrice?: number;
  packageSize?: number;
  packageUnit?: string;
  isSemiPrepared?: boolean;
  semiPreparedId?: string;
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
  customVatPercent: number; // e.g. 11% (alimente) or 21% (alcool, servicii) VAT under July 2025 RO fiscal rules
  calories?: number; // Total calories per product or portion
  allergens?: string[]; // List of allergens
  useVariableMargin?: boolean; // Whether to use variable margin based on cost tier
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
  appliedMarginPercent?: number;
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

export interface SemiPrepared {
  id: string;
  name: string;
  unit: string; // kg, l, buc, g, etc.
  yieldQuantity: number; // e.g. 1 (kg) or 1000 (g)
  recipeItems: RecipeItem[]; // ingredients needed to produce yieldQuantity
  lastUpdated: string; // ISO String
}
