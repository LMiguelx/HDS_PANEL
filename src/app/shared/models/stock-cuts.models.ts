// Contratos de "Recortar negativos" — doc 78, sección 4. /api/orders/billing/stock-cuts.

import { BillingValidationResult } from './billing-validation.models';

export type StockCutMode = 'AUTO' | 'SELECTED';
export type StockCutAction = 'REMOVE_LINE' | 'CANCEL_ORDER';

/** Vista previa. `orderIds` solo con `mode = 'SELECTED'` (máx. 200); con 'AUTO' se ignora. */
export interface StockCutPreviewCommand {
  warehouseId: number;
  productId: number;
  mode: StockCutMode;
  orderIds?: number[];
}

/** Un pedido abierto de hoy que lleva el producto como venta. */
export interface StockCutCandidate {
  orderId: number;
  orderDate: string; // ISO, hora de Lima
  customerId: number;
  customerName: string;
  salespersonId: number;
  salespersonName: string;
  lineNumber: number;
  quantity: number; // lo que lleva del producto (se quita todo)
  lineNetAmount: number; // la línea con su descuento
  orderNetAmount: number; // neto actual del pedido
  saleLineCount: number; // 1 = el producto es su única línea de venta
  planned: boolean; // true = entra en este recorte
  action: StockCutAction | null; // solo si planned
  estimatedNetAfter: number | null; // neto estimado después; 0 si se anula; null si no se pudo estimar
  effects: string[]; // qué pasa, en palabras (solo si planned)
}

export interface StockCutPreview {
  warehouseId: number;
  warehouseName: string;
  productId: number;
  productCode: string;
  productName: string;
  unitOfMeasure: string | null;
  erpQuantity: number | null; // última subida del ERP; null = nunca lo informó (cuenta como 0)
  erpUploadedAt: string | null;
  soldQuantity: number; // vendido hoy (venta + bonificaciones)
  shortfall: number; // faltante = soldQuantity − ERP (0 si alcanza)
  olderOrdersNotInErp: number; // pedidos de días anteriores con el producto que el ERP no subió
  mode: StockCutMode;
  candidateCount: number;
  plannedCount: number;
  plannedQuantity: number; // lo que quita el recorte
  remainingShortfall: number; // lo que seguiría faltando
  surplus: number; // lo que se quita de más (se quitan líneas completas)
  intakeOpen: boolean; // la toma de pedidos está abierta
  warnings: string[]; // avisos listos para mostrar; no impiden recortar
  candidates: StockCutCandidate[]; // del pedido MÁS NUEVO al más antiguo
}

export interface StockCutItem {
  orderId: number;
  expectedQuantity: number; // la quantity que mostró la vista previa
}

export interface ApplyStockCutsCommand {
  warehouseId: number;
  productId: number;
  items: StockCutItem[]; // 1 a 100, en el orden en que se muestran
}

export type StockCutResultCode =
  | 'LINE_REMOVED' // se quitó la línea
  | 'ORDER_CANCELLED' // era su única línea de venta: se anuló
  | 'ORDER_CHANGED' // cambió desde la vista previa: no se tocó
  | 'NOT_FOUND' // no existe o el usuario no lo puede ver
  | 'BLOCKED' // una regla lo impidió; reason dice cuál
  | 'ERROR'; // falló ese pedido; los demás siguieron

export interface StockCutOutcome {
  orderId: number;
  cut: boolean; // true = LINE_REMOVED u ORDER_CANCELLED
  result: StockCutResultCode;
  reason: string | null; // texto listo para mostrar (null en LINE_REMOVED)
}

export interface ApplyStockCutsResult {
  productId: number;
  requested: number;
  cutCount: number;
  notCutCount: number;
  cutQuantity: number; // lo que se quitó del producto
  shortfallAfter: number; // faltante de hoy después del recorte (0 = resuelto)
  intakeOpen: boolean;
  warnings: string[];
  orders: StockCutOutcome[]; // en el orden enviado
  /** Los pedidos a los que se les quitó la línea, ya revalidados (misma forma que /validate). `null` si no hubo ninguno. */
  validation: BillingValidationResult | null;
}
