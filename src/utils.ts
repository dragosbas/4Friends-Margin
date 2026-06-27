import { RawMaterial, FinalProduct, SalePriceBreakdown, ScannedInvoiceItem } from "./types";

export function getRecipeItemUnit(rmUnit: string): string {
  if (!rmUnit) return "";
  const unit = rmUnit.toLowerCase();
  if (unit === "kg" || unit === "kilogram") return "g";
  if (unit === "l" || unit === "litru" || unit === "l (litru)") return "ml";
  return rmUnit;
}

export function getRecipeItemFactor(rmUnit: string): number {
  if (!rmUnit) return 1;
  const unit = rmUnit.toLowerCase();
  if (unit === "kg" || unit === "kilogram") return 1000;
  if (unit === "l" || unit === "litru" || unit === "l (litru)") return 1000;
  return 1;
}

/**
 * Calculates the complete selling price breakdown for a final product.
 */
export function calculateSalePrice(
  product: FinalProduct,
  rawMaterials: RawMaterial[]
): SalePriceBreakdown {
  let totalRawMaterialCost = 0;

  product.recipeItems.forEach((item) => {
    const rawMaterial = rawMaterials.find((rm) => rm.id === item.rawMaterialId);
    if (rawMaterial) {
      const factor = getRecipeItemFactor(rawMaterial.unit);
      totalRawMaterialCost += (item.quantityNeeded / factor) * rawMaterial.purchasePriceBeforeVat;
    }
  });

  const logisticsCost = product.logisticsCost || 0;
  const otherTaxes = product.otherTaxesCost || 0;
  const productionCost = totalRawMaterialCost + logisticsCost + otherTaxes;

  const profitMarginAmount = productionCost * (product.customMarginPercent / 100);
  const salePriceBeforeVat = productionCost + profitMarginAmount;
  const vatAmount = salePriceBeforeVat * (product.customVatPercent / 100);
  const finalSalePriceWithVat = salePriceBeforeVat + vatAmount;

  return {
    totalRawMaterialCost: Number(totalRawMaterialCost.toFixed(4)),
    logisticsCost: Number(logisticsCost.toFixed(2)),
    otherTaxes: Number(otherTaxes.toFixed(2)),
    productionCost: Number(productionCost.toFixed(4)),
    profitMarginAmount: Number(profitMarginAmount.toFixed(4)),
    salePriceBeforeVat: Number(salePriceBeforeVat.toFixed(2)),
    vatAmount: Number(vatAmount.toFixed(2)),
    finalSalePriceWithVat: Number(finalSalePriceWithVat.toFixed(2)),
  };
}

/**
 * Formats a number as a Romanian RON price.
 */
export function formatRON(amount: number): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a percentage.
 */
export function formatPercent(value: number): string {
  return `${value}%`;
}

/**
 * Parses a Romanian ANAF E-Factura UBL XML invoice.
 */
export function parseEFacturaXML(xmlText: string): {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  items: ScannedInvoiceItem[];
} {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    // Check for parse errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Format XML nevalid sau corupt.");
    }

    // Helper to extract text by tag name, ignoring namespaces
    const getElementText = (parent: Element | Document, tagName: string): string => {
      // Try with namespace first or tag name
      const element = parent.getElementsByTagName(tagName)[0] || 
                      parent.getElementsByTagNameNS("*", tagName)[0];
      return element ? element.textContent || "" : "";
    };

    // Extract Supplier Name
    // Usually inside AccountingSupplierParty -> Party -> PartyLegalEntity -> RegistrationName
    let supplierName = "";
    const supplierParty = xmlDoc.getElementsByTagName("cac:AccountingSupplierParty")[0] || 
                          xmlDoc.getElementsByTagName("AccountingSupplierParty")[0] ||
                          xmlDoc.getElementsByTagNameNS("*", "AccountingSupplierParty")[0];
    
    if (supplierParty) {
      const legalEntity = supplierParty.getElementsByTagName("cac:PartyLegalEntity")[0] || 
                          supplierParty.getElementsByTagName("PartyLegalEntity")[0] ||
                          supplierParty.getElementsByTagNameNS("*", "PartyLegalEntity")[0];
      if (legalEntity) {
        supplierName = getElementText(legalEntity, "cbc:RegistrationName") || getElementText(legalEntity, "RegistrationName");
      }
      
      if (!supplierName) {
        const partyName = supplierParty.getElementsByTagName("cac:PartyName")[0] || 
                          supplierParty.getElementsByTagName("PartyName")[0] ||
                          supplierParty.getElementsByTagNameNS("*", "PartyName")[0];
        if (partyName) {
          supplierName = getElementText(partyName, "cbc:Name") || getElementText(partyName, "Name");
        }
      }
    }

    if (!supplierName) {
      supplierName = "Furnizor SPV Anonim";
    }

    // Extract Invoice Number (cbc:ID directly under Invoice)
    const invoiceNumber = getElementText(xmlDoc, "cbc:ID") || getElementText(xmlDoc, "ID") || "F-XML-SPV";

    // Extract Invoice Date (cbc:IssueDate under Invoice)
    const invoiceDate = getElementText(xmlDoc, "cbc:IssueDate") || getElementText(xmlDoc, "IssueDate") || new Date().toISOString().split('T')[0];

    // Extract Items
    const items: ScannedInvoiceItem[] = [];
    let invoiceLines = xmlDoc.getElementsByTagName("cac:InvoiceLine");
    if (invoiceLines.length === 0) {
      invoiceLines = xmlDoc.getElementsByTagName("InvoiceLine");
    }
    if (invoiceLines.length === 0) {
      const fallbackLines = xmlDoc.getElementsByTagNameNS("*", "InvoiceLine");
      if (fallbackLines.length > 0) {
        invoiceLines = fallbackLines as any;
      }
    }

    const linesArray = Array.from(invoiceLines);
    
    linesArray.forEach((line) => {
      // Item Name: cac:Item -> cbc:Name
      const itemEl = line.getElementsByTagName("cac:Item")[0] || 
                     line.getElementsByTagName("Item")[0] ||
                     line.getElementsByTagNameNS("*", "Item")[0];
      const name = itemEl ? (getElementText(itemEl, "cbc:Name") || getElementText(itemEl, "Name")) : "Articol Factură";

      // Quantity: cbc:InvoicedQuantity
      const quantityText = getElementText(line, "cbc:InvoicedQuantity") || getElementText(line, "InvoicedQuantity") || "1";
      const quantity = parseFloat(quantityText) || 1;

      // Unit of Measure
      const invQtyEl = line.getElementsByTagName("cbc:InvoicedQuantity")[0] || 
                       line.getElementsByTagName("InvoicedQuantity")[0] ||
                       line.getElementsByTagNameNS("*", "InvoicedQuantity")[0];
      const unitOfMeasure = invQtyEl ? invQtyEl.getAttribute("unitCode") || "buc" : "buc";

      // Price: cac:Price -> cbc:PriceAmount
      const priceEl = line.getElementsByTagName("cac:Price")[0] || 
                      line.getElementsByTagName("Price")[0] ||
                      line.getElementsByTagNameNS("*", "Price")[0];
      const priceText = priceEl ? (getElementText(priceEl, "cbc:PriceAmount") || getElementText(priceEl, "PriceAmount")) : "0";
      const unitPriceBeforeVat = parseFloat(priceText) || 0;

      // VAT: cac:Item -> cac:ClassifiedTaxCategory -> cbc:Percent
      let vatPercent = 21; // Default Romanian standard VAT (sugary/non-food/etc)
      if (itemEl) {
        const taxCategory = itemEl.getElementsByTagName("cac:ClassifiedTaxCategory")[0] || 
                            itemEl.getElementsByTagName("ClassifiedTaxCategory")[0] ||
                            itemEl.getElementsByTagNameNS("*", "ClassifiedTaxCategory")[0];
        if (taxCategory) {
          const vatText = getElementText(taxCategory, "cbc:Percent") || getElementText(taxCategory, "Percent");
          if (vatText) {
            vatPercent = parseFloat(vatText);
          }
        }
      }

      const totalPriceBeforeVat = quantity * unitPriceBeforeVat;

      items.push({
        name,
        quantity,
        unitOfMeasure: translateUnitCode(unitOfMeasure),
        unitPriceBeforeVat,
        vatPercent,
        totalPriceBeforeVat: Number(totalPriceBeforeVat.toFixed(4)),
      });
    });

    // Fallback: If no lines found, try parsing as simple generic structure
    if (items.length === 0) {
      throw new Error("Nu s-au găsit rânduri de produse în fișierul XML.");
    }

    return {
      supplierName,
      invoiceNumber,
      invoiceDate,
      items,
    };
  } catch (error: any) {
    console.error("XML Parse Error:", error);
    throw new Error(`Eroare la procesarea XML E-factura: ${error.message}`);
  }
}

/**
 * Translates standard UNECE unit codes to friendly Romanian abbreviations.
 */
function translateUnitCode(code: string): string {
  if (!code) return "buc";
  const upper = code.toUpperCase();
  switch (upper) {
    case "KGM":
    case "KG":
      return "kg";
    case "LTR":
    case "Ltr":
    case "L":
      return "l";
    case "HUR":
    case "H":
      return "ore";
    case "MTR":
    case "M":
      return "m";
    case "MTK":
      return "mp";
    case "MTQ":
      return "mc";
    case "C62":
    case "H87":
    case "PCE":
    case "BUC":
      return "buc";
    default:
      return "buc";
  }
}

/**
 * Generates and downloads a CSV file for profitability reports.
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const csvContent = [
    // Adding BOM for Romanian diacritics to excel compatibility
    "\uFEFF" + headers.map(h => `"${h}"`).join(","),
    ...rows.map(row => row.map(cell => {
      if (typeof cell === "string") {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Removes Romanian diacritics and replaces them with standard Latin letters.
 */
export function removeDiacritics(str: string): string {
  if (!str) return "";
  const from = "ĂÂÎȘȚăâîșțáéíóúýÁÉÍÓÚÝäëïöüÄËÏÖÜâêîôûÂÊÎÔÛşţŞŢ";
  const to =   "AAISTaaistaeioouyAEIOOUYaeiouAEIOUaeiouAEIOUstST";
  let res = "";
  for (let i = 0; i < str.length; i++) {
    const idx = from.indexOf(str[i]);
    if (idx !== -1) {
      res += to[idx];
    } else {
      res += str[i];
    }
  }
  return res;
}

/**
 * Normalizes a product/raw material name:
 * 1. Removes Romanian diacritics
 * 2. Converts to UPPERCASE
 * 3. Collapses multiple spaces and trims
 */
export function normalizeMaterialName(str: string): string {
  return removeDiacritics(str).toUpperCase().replace(/\s+/g, " ").trim();
}

