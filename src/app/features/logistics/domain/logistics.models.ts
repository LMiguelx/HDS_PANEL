// Contratos del Inicio de logística — doc 93, sección 2.4.
// GET /api/logistics/dashboard?date= (sin `date` = hoy). Cada bloque llega
// `null` si el usuario no tiene el permiso de su pantalla: no se muestra
// (nunca deshabilitado ni en 0).

export interface LogisticsDashboardView {
  date: string; // yyyy-MM-dd, el día consultado
  warehouseId: number; // NO mostrar
  warehouseName: string;
  branchId: number; // NO mostrar
  branchName: string;
  generatedAt: string; // ISO, para "Actualizado hace N min"
  alerts: LogisticsAlertsView;
  picking: PickingDayView | null; // null = sin permiso → no mostrar
  returns: ReturnsDayView | null; // null = sin permiso → no mostrar
}

export interface LogisticsAlertsView {
  batchesNotReady: number | null; // planillas OPEN del día con picking sin cerrar
  negativeProducts: number | null; // productos en negativo del día
  receiptsInReview: ReceiptAlertView | null;
  receiptsNotTakenByErp: ReceiptAlertView | null;
  erpStock: ErpStockAlertView | null;
}

export interface ReceiptAlertView {
  count: number;
  oldestAt: string | null; // la más antigua del grupo; null si count = 0
}

export interface ErpStockAlertView {
  lastUploadAt: string | null; // última subida REAL del ERP (no cuenta el re-cuadre nocturno)
  minutesSinceLastUpload: number | null; // null si el ERP nunca subió
  pendingUploads: number; // filas subidas aún sin procesar
  failedProducts: number; // productos cuyo último cuadre falló
  lastResyncAt: string | null; // último re-cuadre nocturno
}

export interface PickingDayView {
  totalBatches: number;
  pickingClosed: number;
  pickingOpen: number;
  notReadyToLeave: number; // abiertas con picking sin cerrar (= batchesNotReady)
  withShortfall: number; // con al menos un producto cargado de menos
  withoutTeam: number; // sin equipo de reparto
  topShortProducts: ShortProductView[]; // hasta 5, del mayor faltante al menor
}

export interface ShortProductView {
  productId: number; // NO mostrar
  productCode: string;
  productName: string;
  unitOfMeasure: string | null;
  shortQuantity: number; // suma de lo que faltó cargar en todas las planillas
  batchCount: number; // en cuántas planillas faltó
  lastNote: string | null; // último motivo declarado
}

/** Devoluciones REGISTRADAS ese día (lo que vuelve al almacén). */
export interface ReturnsDayView {
  invoicesWithReturns: number;
  productCount: number;
  units: number;
  amount: number; // S/
  byReason: ReturnReasonCountView[]; // del motivo con más unidades al de menos
  topProducts: ReturnedProductView[]; // hasta 5, del más devuelto al menos
}

export interface ReturnReasonCountView {
  reasonCode: string; // DAMAGED | CUSTOMER_REJECTED | WRONG_ITEM | EXPIRED | OTHER
  reasonName: string; // mostrar este
  lineCount: number;
  units: number;
}

export interface ReturnedProductView {
  productId: number; // NO mostrar
  productCode: string;
  productName: string;
  unitOfMeasure: string | null;
  units: number;
  amount: number;
  invoiceCount: number;
}
