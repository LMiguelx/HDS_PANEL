// Contratos de Pedidos (/orders). Ver doc 27 (listado/detalle/reportes) y
// doc 30 (pedido de mostrador, origen, editar/entregar/facturar/anular).

export interface OrderSummary {
  orderId: number;
  customerId: number;
  customerName: string;
  orderDate: string; // ISO datetime
  statusCode: string; // OPEN | SENT_TO_BILLING | COUNTER_DELIVERED | CANCELLED
  totalAmount: number;
  discountAmount: number;
  netAmount: number; // totalAmount - discountAmount
  paymentConditionId: number;
  bonusLines: number;
  deliveryStatusCode: string | null; // IN_ROUTE | DELIVERED | PARTIAL | REJECTED
  originCode: string; // FIELD | COUNTER | TELESALES — doc 42, sección 3.1
}

/**
 * Fila del listado global (GET /orders) — ver
 * 27-panel-admin-pedidos-reportes-ventas-dashboard.md, sección 5.3. Mismos
 * campos que OrderSummary más salespersonId/salespersonName (columna
 * "Vendedor"). No reemplaza OrderSummary: GET /orders/customer/{id} sigue
 * devolviendo esa forma, no está documentada en este archivo.
 * originCode/createdById/createdByName — ver doc 30, sección 9.1.
 */
/**
 * sentToBillingAt/erpUploaded/erpUploadedAt — doc 32, sección 5.2: cuándo
 * se envió a facturación y si facturación ya lo recibió (sección 3.5).
 */
export interface AdminOrderSummary extends OrderSummary {
  salespersonId: number;
  salespersonName: string;
  createdById: number;
  createdByName: string;
  sentToBillingAt: string | null;
  erpUploaded: boolean;
  erpUploadedAt: string | null;
}

export interface OrderListFilters {
  customerId?: number;
  salespersonId?: number;
  from?: string; // yyyy-MM-dd, inclusive
  to?: string; // yyyy-MM-dd, inclusive
  statusCode?: string;
  originCode?: string; // FIELD | COUNTER | TELESALES — doc 30, sección 9.1; doc 42, sección 3.1
  page?: number;
  size?: number;
}

export interface OrderItemView {
  lineNumber: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  bonus: boolean;
  allocationId: number | null; // con valor: la línea es Dotación — doc 36, sección 3.1
  stockPending: boolean; // true = bonificación otorgada sin stock que la respalde
  discountAmount: number; // doc 47, sección 12.1 — descuento real de ESTA línea
  netSubtotal: number; // subtotal - discountAmount
}

export interface ReturnedLineView {
  productId: number;
  quantity: number;
  bonus: boolean;
}

export interface DeliveryStatusView {
  // Independiente del statusCode del pedido — mismo catálogo delivery_item_status.
  statusCode: string; // IN_ROUTE | DELIVERED | PARTIAL | REJECTED
  returnedLines: ReturnedLineView[];
}

/**
 * GET /orders/{orderId} — doc 30, sección 9.2 agrega salespersonName,
 * originCode, createdById/createdByName y salesChannelId/Name.
 */
export interface OrderDetail {
  orderId: number;
  customerId: number;
  customerName: string;
  salespersonId: number;
  paymentConditionId: number;
  statusCode: string; // OPEN | SENT_TO_BILLING | COUNTER_DELIVERED | CANCELLED
  orderDate: string;
  note: string | null;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  sentToBillingAt: string | null;
  items: OrderItemView[];
  deliveryStatus: DeliveryStatusView | null;
  salespersonName: string;
  originCode: string; // FIELD | COUNTER | TELESALES — doc 42, sección 3.1
  createdById: number;
  createdByName: string;
  salesChannelId: number | null;
  salesChannelName: string | null;
  erpUploaded: boolean; // NUEVO (doc 32, sección 9.3)
  erpUploadedAt: string | null; // null si facturación aún no lo recibió
}

/** PATCH /orders/{orderId}/items — doc 30, sección 8.2. Solo pedidos OPEN. */
export interface OrderItemEditCommand {
  productId: number;
  newQuantity: number; // cantidad FINAL; 0 = quitar la línea
}

/** Dotación que cambia al editar — doc 36, sección 6.2. */
export interface AllocationEditCommand {
  allocationId: number;
  newQuantity: number; // cantidad FINAL, 0 o más, hasta 2 decimales; 0 = quitar
}

export interface UpdateOrderCommand {
  paymentConditionId?: number | null; // null/omitido = no cambia
  catalogItems: OrderItemEditCommand[];
  predictedItems: OrderItemEditCommand[];
  allocationItems?: AllocationEditCommand[]; // NUEVO (doc 36) — dotaciones del vendedor que cambian
}

// — Bonificaciones sin stock — doc 51, secciones 5 a 8. Reemplaza al viejo
// GET /orders/pending-bonuses (obsoleto, pero sigue respondiendo): ya no se
// usa PendingBonusLineView/PendingBonusOrderView en el panel.

/** Fila de un pedido dentro de un grupo de la bandeja — doc 51, sección 5.2. */
export interface PendingBonusOrderRow {
  orderId: number; // mostrar como "N.º de pedido"
  orderDate: string;
  originCode: string; // FIELD | TELESALES | COUNTER
  customerCode: string;
  customerName: string;
  salespersonCode: string;
  salespersonName: string;
  quantity: number;
  availableStock: number | null;
}

/** Una promoción+producto sin stock, con los pedidos que la deben — doc 51, sección 5.2. */
export interface PendingBonusGroupView {
  promoId: number; // NO mostrar — se envía al resolver en lote
  promoCode: string;
  promoName: string;
  productId: number; // NO mostrar — se envía como originalProductId
  productCode: string;
  productName: string;
  brandName: string;
  orderCount: number;
  totalQuantity: number;
  availableStock: number | null; // null = pedidos de varias sedes
  orders: PendingBonusOrderRow[];
}

/** Dotación pendiente: solo seguimiento, se resuelve editando el pedido — doc 51, sección 5.2. */
export interface PendingAllocationBonusView {
  orderId: number;
  orderDate: string;
  customerCode: string;
  customerName: string;
  salespersonCode: string;
  salespersonName: string;
  allocationId: number; // NO mostrar
  productId: number; // NO mostrar
  productCode: string;
  productName: string;
  quantity: number;
  availableStock: number;
}

export interface PendingBonusInboxView {
  orderCount: number;
  lineCount: number;
  promoBonuses: PendingBonusGroupView[];
  allocationBonuses: PendingAllocationBonusView[];
}

/** Candidato a sustituto — doc 51, sección 6.2. */
export interface SubstituteCandidateView {
  productId: number; // NO mostrar — se envía como substituteProductId
  code: string;
  name: string;
  brandName: string;
  unitOfMeasure: string;
  availableStock: number;
}

/**
 * `substituteProductId` null = NO OTORGAR. `substituteQuantity` solo se
 * envía junto con `substituteProductId`; null = la misma cantidad que se
 * debía — doc 51, sección 7.1.
 */
export interface BonusResolutionCommand {
  originalProductId: number;
  substituteProductId?: number | null;
  substituteQuantity?: number | null;
}

export interface ResolvePendingBonusesCommand {
  resolutions: BonusResolutionCommand[]; // al menos una
}

/** POST /orders/pending-bonuses/resolve-batch — doc 51, sección 8.1. */
export interface ResolvePendingBonusBatchCommand {
  promoId: number;
  originalProductId: number;
  orderIds: number[]; // 1 a 100
  substituteProductId?: number | null; // null = NO OTORGAR
  substituteQuantity?: number | null; // null = cada pedido recibe lo que se le debía
}

export interface BatchResolutionRow {
  orderId: number;
  resolved: boolean;
  message: string | null; // null si se resolvió
}

export interface BatchResolutionResult {
  requested: number;
  resolved: number;
  failed: number;
  results: BatchResolutionRow[];
}

// — Resumen global del día (admin), ver 24-panel-admin-... sección 7 —

export interface BrandSalesView {
  brandId: number;
  brandName: string;
  grossAmount: number; // subtotal de líneas no-bonus
  discountAmount: number; // suma del descuento real de cada línea de esta marca — doc 47, sección 16
  netAmount: number; // grossAmount - discountAmount
  bonusUnits: number; // unidades regaladas, sin monto — aparte
}

/**
 * Equivalente global (todo el tenant) de la liquidación diaria de un
 * vendedor, sin lista de pedidos — para el detalle línea por línea usar
 * GET /api/orders. totalOrders cuenta también los CANCELLED; ningún monto
 * los incluye.
 */
export interface GlobalDailyOrderSummaryView {
  date: string;
  totalOrders: number;
  totalAmount: number;
  totalDiscountAmount: number;
  totalNetAmount: number;
  totalBonusLines: number;
  totalBonusUnits: number;
  salesByBrand: BrandSalesView[];
}
