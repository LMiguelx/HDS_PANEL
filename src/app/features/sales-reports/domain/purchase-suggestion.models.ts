// Contratos de "Sugerido de compra" — doc 94, sección 3.
// GET /api/logistics/purchase-suggestion?brandId=&coverageDays=

export interface PurchaseSuggestionSummary {
  productCount: number; // productos en la lista
  toOrderCount: number; // con sugerido > 0
  suggestedPackages: number; // total de paquetes sugeridos
  suggestedUnits: number; // total de unidades sugeridas
  estimatedCost: number | null; // S/; null si ningún producto a pedir tiene costo
  withoutCostCount: number; // productos a pedir sin costo (no suman al monto)
}

export interface PurchaseSuggestionRow {
  productId: number; // NO mostrar
  productCode: string;
  productName: string;
  brandId: number; // NO mostrar
  brandName: string; // mostrar solo en "Todas las marcas"
  familyName: string | null;
  unitOfMeasure: string | null; // UND, PAQ, …
  unitsPerPackage: number | null;
  consumptionPerDay: number; // 2 decimales
  consumptionPerWeek: number; // 2 decimales
  consumptionLast4Weeks: number;
  previousWeeklyAverage: number;
  trendPercent: number | null; // 1 decimal; null = sin historia previa
  erpStock: number;
  erpStockAt: string | null; // null = el ERP nunca subió este producto
  coverageDays: number | null; // 1 decimal; null = sin consumo
  suggestedUnits: number; // 0 = no hay que pedir
  suggestedPackages: number | null; // null = el producto no maneja paquetes
  unitCost: number | null;
  estimatedCost: number | null;
}

export interface PurchaseSuggestionReport {
  warehouseId: number; // NO mostrar
  warehouseName: string; // "ALMACEN PRINCIPAL"
  brandId: number | null; // null = todas las marcas
  brandName: string | null;
  coverageTargetDays: number; // días a cubrir usados en el cálculo
  windowFrom: string; // yyyy-MM-dd, inicio de las 4 semanas
  windowTo: string; // yyyy-MM-dd, fin (excluido) = hoy
  trendFrom: string; // yyyy-MM-dd, inicio de las 8 semanas anteriores
  sellingDays: number; // días con venta en la ventana
  generatedAt: string; // ISO
  summary: PurchaseSuggestionSummary;
  products: PurchaseSuggestionRow[];
}
