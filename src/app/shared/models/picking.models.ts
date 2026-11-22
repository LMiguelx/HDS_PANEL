// Contratos de Picking (armado de carga por planilla) — doc 89, corregidos
// contra el backend real por doc 93, sección 4.1-4.2 (invoices/lines,
// consolidatedByProduct, vehiclePlate/driverName).

export interface PickingStatusCounts {
  complete: number;
  shortLoaded: number;
  notLoaded: number;
  pending: number;
}

/** Fila del listado (`GET /api/deliveries/picking`). */
export interface PickingSummary {
  batchId: number;
  batchDate: string; // yyyy-MM-dd
  series: number;
  number: number;
  vehiclePlate: string | null;
  driverName: string | null;
  statusCode: string; // OPEN | IN_ROUTE | SETTLED (de la planilla)
  invoiceCount?: number;
  pickingConfirmedAt: string | null; // null = picking abierto
  pickingConfirmedByName?: string | null;
  pickingCounts: PickingStatusCounts;
}

export interface PickingListFilters {
  date?: string;
  onlyPending?: boolean;
  page?: number;
  size?: number;
}

/** Consolidado por producto — la vista principal para cargar el camión. */
export interface PickingProductConsolidatedView {
  productId: number;
  productCode: string;
  productName: string;
  unitOfMeasure: string | null;
  unitsPerPackage: number | null; // null = no maneja paquetes
  totalQuantity: number; // esperado, incluye bonificación
  bonusQuantity: number;
  fullPackages: number | null; // calculado en backend
  looseUnits: number | null; // calculado en backend
  loadedQuantity: number | null; // null mientras está PENDING
  shortQuantity: number;
  pickingStatus: string; // PENDING | COMPLETE | SHORT | NOT_LOADED
  shortNote: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
}

/** Línea de un comprobante — desglose de solo consulta (doc 93, sección 4.1). */
export interface PickingLineView {
  productId: number;
  productCode: string | null;
  productName: string | null;
  familyName: string | null;
  unitOfMeasure: string | null;
  unitsPerPackage: number | null;
  weightKg: number | null;
  quantity: number;
  bonus: boolean;
}

export interface PickingInvoiceView {
  invoiceId: string;
  customerName: string | null;
  lines: PickingLineView[];
}

/** Detalle de la planilla (`GET /api/deliveries/picking/{batchId}`). */
export interface PickingDetail {
  batchId: number;
  batchDate: string;
  series: number;
  number: number;
  vehiclePlate: string | null;
  driverName: string | null;
  statusCode: string;
  pickingConfirmedAt: string | null;
  pickingConfirmedByName?: string | null;
  invoices: PickingInvoiceView[];
  consolidatedByProduct: PickingProductConsolidatedView[];
  pickingCounts: PickingStatusCounts;
}

export interface PickingItemCommand {
  productId: number;
  loadedQuantity: number;
  shortNote?: string | null;
}

export interface DeclarePickingItemsCommand {
  items: PickingItemCommand[];
}
