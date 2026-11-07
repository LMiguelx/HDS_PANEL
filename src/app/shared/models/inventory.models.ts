// Contratos de Inventario/Stock (/api/inventory). Ver
// 21-panel-admin-usuarios-roles-catalogo-precios-inventario.md, sección 8.
import { PageResponse } from './api.models';

export interface WarehouseView {
  warehouseId: number;
  branchId: number;
  code: string;
  name: string;
}

/**
 * Tipos de movimiento del kardex — doc 35, sección 3.7. El nombre llega
 * listo en `movementTypeName`; esta lista solo documenta de dónde sale cada
 * uno y su signo.
 * SALE_PROMISE(-) BONUS_OUT(-) ORDER_EDIT(+) BONUS_REVERSAL(+)
 * ORDER_CANCEL(+) MANUAL_ADJUSTMENT(±) ADVANCE_IN(+) ADVANCE_RELEASE(-)
 * ERP_SYNC(±, sin usuario) RETURN(+, solo histórico)
 */
export type MovementTypeCode =
  | 'SALE_PROMISE'
  | 'BONUS_OUT'
  | 'ORDER_EDIT'
  | 'BONUS_REVERSAL'
  | 'ORDER_CANCEL'
  | 'MANUAL_ADJUSTMENT'
  | 'ADVANCE_IN'
  | 'ADVANCE_RELEASE'
  | 'ERP_SYNC'
  | 'RETURN';

/** Origen de un movimiento — doc 35, sección 3.8. */
export type ReferenceTable =
  'sales_order' | 'stock_advance' | 'stock_reconciliation' | 'delivery_return' | null;

export interface MovementView {
  stockMovementId: number;
  warehouseId: number;
  warehouseName: string;
  productId: number;
  movementTypeCode: MovementTypeCode | string;
  movementTypeName: string; // listo para mostrar
  quantity: number; // ± (positivo entra, negativo sale)
  referenceTable: ReferenceTable | string;
  referenceId: string | null;
  note: string | null;
  createdBy: number | null; // null = automático
  createdByName: string | null; // null = automático
  createdAt: string;
}

export interface KardexResponse {
  productId: number;
  productName: string;
  currentStock: number;
  movements: PageResponse<MovementView>;
}

export type AdjustmentMode = 'INCREASE' | 'DECREASE' | 'SET';

export interface StockAdjustmentLine {
  productCode: string; // código, no el id
  warehouseId: number;
  quantity: number; // siempre positivo, el mode define el signo
}

export interface BulkStockAdjustmentCommand {
  mode: AdjustmentMode; // aplica a toda la lista
  note?: string; // max 255
  lines: StockAdjustmentLine[];
}

export interface LineResult {
  lineIndex: number;
  productCode: string;
  warehouseId: number;
  applied: boolean;
  appliedDelta: number | null;
  errorReason: string | null;
}

export interface BulkStockAdjustmentResult {
  totalLines: number;
  appliedCount: number;
  lines: LineResult[];
}

export interface WarehouseStockItem {
  productId: number;
  productCode: string;
  productName: string;
  familyId: number;
  familyName: string;
  brandId: number;
  brandName: string;
  unitOfMeasure: string;
  unitsPerPackage: number;
  weightKg: number;
  isBonusEligible: boolean;
  quantity: number;
  updatedAt: string;
}

export interface WarehouseStockResponse {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  items: WarehouseStockItem[];
}

// ─────────────────────────── Adelantos de stock (doc 35, sección 6) ───────────────────────────

/** Estado del adelanto — doc 35, sección 3.1. `open` es `true` solo en OPEN. */
export type StockAdvanceStatusCode = 'OPEN' | 'COVERED' | 'RELEASED' | 'CLOSED';

export interface StockAdvanceLine {
  productCode: string;
  warehouseId: number;
  quantity: number; // > 0, hasta 2 decimales
}

export interface CreateStockAdvancesCommand {
  note: string; // obligatorio, máx. 255 — aplica a todas las líneas
  lines: StockAdvanceLine[];
}

export interface StockAdvanceLineResult {
  lineIndex: number;
  productCode: string;
  warehouseId: number;
  applied: boolean;
  advanceId: number | null;
  quantity: number | null;
  pendingBefore: number | null; // lo que ya estaba adelantado y sin cubrir de ese producto
  errorReason: string | null;
  warnings: StockAdvanceWarning[]; // NUEVO — doc 69, sección 4.3: los mismos de la revisión, calculados al crear
}

export interface CreateStockAdvancesResult {
  totalLines: number;
  appliedCount: number;
  lines: StockAdvanceLineResult[];
}

// ───────────────── Adelantar con revisión previa — doc 69 ─────────────────

/** `code` NO se muestra: define ícono y tono. `message` llega listo para mostrar. */
export type StockAdvanceWarningCode = 'ERP_UPLOAD_PENDING' | 'RECENT_ERP_INCREASE';

export interface StockAdvanceWarning {
  code: StockAdvanceWarningCode;
  message: string;
  pendingUploads: number | null; // solo ERP_UPLOAD_PENDING
  erpIncrease: number | null; // solo RECENT_ERP_INCREASE
  erpIncreaseAt: string | null; // solo RECENT_ERP_INCREASE
}

export interface PreviewStockAdvancesCommand {
  lines: StockAdvanceLine[];
}

export interface StockAdvancePreviewLine {
  lineIndex: number; // posición en el arreglo enviado — para cruzar con la fila
  productCode: string;
  warehouseId: number; // NO mostrar
  valid: boolean; // false = producto o almacén no existen
  pendingBefore: number | null; // null si no es válida
  errorReason: string | null;
  warnings: StockAdvanceWarning[]; // [] si no hay avisos
}

export interface StockAdvancePreviewResult {
  totalLines: number;
  linesWithWarnings: number; // > 0 → mostrar el modal de revisión
  invalidLines: number; // > 0 → hay filas que no se pueden adelantar
  lines: StockAdvancePreviewLine[];
}

export interface StockAdvanceView {
  advanceId: number;
  warehouseId: number;
  warehouseName: string;
  productId: number;
  productCode: string;
  productName: string;
  quantity: number; // lo adelantado
  coveredQuantity: number; // lo que ya respaldó el stock del ERP
  releasedQuantity: number; // lo que retiró supervisión
  pendingQuantity: number; // lo que falta respaldar
  open: boolean; // true mientras pendingQuantity sea mayor a 0
  statusCode: StockAdvanceStatusCode;
  lastUploadId: number | null; // última subida del ERP que lo cubrió
  note: string;
  createdBy: number;
  createdByName: string;
  createdAt: string;
}

export interface StockAdvanceListFilters {
  warehouseId?: number;
  productId?: number;
  onlyOpen?: boolean; // por defecto true
  from?: string; // yyyy-MM-dd
  to?: string;
  page?: number;
  size?: number;
}

export interface ReleaseStockAdvanceCommand {
  quantity?: number; // sin enviar: retira TODO lo pendiente (anular). Con valor: reduce
  note: string; // obligatorio, máx. 255
}

// ───────────────────────── Cuadre con el ERP (doc 35, sección 8) ─────────────────────────

/** Estado de una subida del ERP — doc 35, sección 3.3; `SUPERSEDED` — doc 67, sección 3.1. */
export type ReconciliationStatusCode = 'APPLIED' | 'FAILED' | 'SUPERSEDED';

/** Motivo de una subida fallida — doc 35, sección 3.4. Solo si statusCode = FAILED. */
export type ReconciliationFailureCode = 'WAREHOUSE_NOT_FOUND' | 'UNEXPECTED_ERROR';

/** Filtro por resultado del listado de cuadres — doc 35, sección 3.6; `SUPERSEDED` — doc 67, sección 3.3. */
export type ReconciliationResultFilter =
  'DIFFERENCE' | 'MATCHED' | 'INCREASED' | 'DECREASED' | 'SHORTFALL' | 'FAILED' | 'SUPERSEDED';

export interface StockReconciliationSummary {
  from: string;
  to: string;
  pendingUploads: number; // subidas del ERP en cola, aún sin procesar
  failedCount: number; // subidas fallidas sin resolver, de cualquier fecha
  lastUploadAt: string | null;
  lastProcessedAt: string | null;
  processedCount: number; // del período
  matchedCount: number;
  increasedCount: number;
  decreasedCount: number;
  shortfallCount: number;
  supersededCount: number; // NUEVO — doc 67, sección 4.1: reemplazadas del período
}

export interface StockReconciliationView {
  uploadId: number;
  warehouseId: number;
  warehouseName: string;
  productId: number;
  productCode: string;
  productName: string;
  statusCode: ReconciliationStatusCode;
  failureCode: ReconciliationFailureCode | null;
  erpQuantity: number | null;
  committedQuantity: number | null;
  advanceBeforeQuantity: number | null;
  advanceCoveredQuantity: number | null;
  stockBefore: number | null;
  appliedDelta: number | null;
  stockAfter: number | null;
  shortfall: number | null;
  uploadedAt: string;
  processedAt: string;
}

export interface StockReconciliationListFilters {
  warehouseId?: number;
  productId?: number;
  result?: ReconciliationResultFilter;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export interface ReconciliationMovementView {
  stockMovementId: number;
  movementTypeCode: MovementTypeCode | string;
  movementTypeName: string;
  quantity: number; // con signo
  referenceTable: ReferenceTable | string;
  referenceId: string | null;
  note: string | null;
  createdBy: number | null; // null = automático
  createdByName: string | null;
  createdAt: string;
}

export interface StockReconciliationDetail {
  reconciliation: StockReconciliationView;
  previousProcessedAt: string | null; // null = este es el primer cuadre del producto
  movements: ReconciliationMovementView[]; // del más reciente al más antiguo, máx. 200
  explanation: ReconciliationExplanation; // NUEVO — doc 56, sección 9.5
}

export interface ProcessUploadsResult {
  processed: number; // subidas cuadradas (aplicadas o fallidas) en TODA la llamada — doc 67, sección 4.4
  superseded: number; // NUEVO — subidas cerradas como reemplazadas en esta llamada
}

// ───────────────────── Cuadre con el ERP (rediseño) — doc 56, sección 9 ─────────────────────

/** Una actualización del ERP: todos los productos que subió de una vez — sección 9.3. */
export interface ErpSyncView {
  warehouseId: number; // NO mostrar
  warehouseName: string;
  firstUploadId: number; // NO mostrar — sirve para abrir sus productos
  lastUploadId: number; // NO mostrar — sirve para abrir sus productos
  startedAt: string;
  endedAt: string;
  productCount: number; // productos que subió el ERP
  pendingCount: number; // aún en proceso
  matchedCount: number;
  increasedCount: number;
  decreasedCount: number;
  failedCount: number;
  supersededCount: number; // NUEVO — doc 67, sección 4.2: reemplazadas por una subida más nueva
}

export interface ErpSyncListFilters {
  warehouseId?: number;
  from?: string; // yyyy-MM-dd; sin fechas: hoy
  to?: string;
}

/** Motivo de un cuadre — doc 56, sección 4.2; `SUPERSEDED` — doc 67, sección 3.2. */
export type ReconciliationReason =
  | 'MATCHED'
  | 'ERP_INCREASE'
  | 'MANUAL_ADJUSTMENT'
  | 'ORDER_RETURNED'
  | 'UNRECORDED_CHANGE'
  | 'UNEXPLAINED'
  | 'FIRST_SYNC'
  | 'FAILED'
  | 'SUPERSEDED';

/** Filtro por resultado de los productos de una actualización — doc 56, sección 4.3; `SUPERSEDED` — doc 67, sección 5.3. */
export type SyncProductResultFilter =
  'DIFFERENCE' | 'INCREASED' | 'DECREASED' | 'FAILED' | 'MATCHED' | 'SUPERSEDED';

export interface ReconciliationExplanation {
  previousUploadId: number | null; // NO mostrar
  previousUploadAt: string | null; // hora de la actualización anterior del producto; null si es la primera
  previousErpQuantity: number | null; // lo que el ERP dijo la vez anterior
  erpChange: number | null; // cuánto cambió el ERP entre las dos
  appAfterPrevious: number | null; // lo que la app quedó después del cuadre anterior
  ordersQuantity: number; // pedidos, neto (ventas restan; ediciones/anulaciones suman)
  ordersReturnedQuantity: number; // de lo anterior, lo devuelto por ediciones/anulaciones
  advancesQuantity: number; // adelantos (+) y retiros de adelanto (−)
  manualQuantity: number; // ajustes manuales
  lastManualAdjustmentBy: string | null; // quién hizo el último ajuste manual; null si no hubo
  otherQuantity: number; // otros movimientos
  unrecordedQuantity: number; // cambio sin registro (normalmente 0)
  reason: ReconciliationReason;
  reasonText: string; // LISTO PARA MOSTRAR
}

export interface ReconciliationRow {
  reconciliation: StockReconciliationView;
  explanation: ReconciliationExplanation;
}

export interface SyncProductsFilters {
  firstUploadId: number;
  lastUploadId: number;
  warehouseId?: number;
  result?: SyncProductResultFilter; // el panel envía DIFFERENCE por defecto
  page?: number;
  size?: number;
}
