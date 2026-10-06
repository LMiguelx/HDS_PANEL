// Contratos de Pedidos (/orders). Ver doc 27 (listado/detalle/reportes) y
// doc 30 (pedido de mostrador, origen, editar/entregar/facturar/anular).

export interface OrderSummary {
  orderId: number;
  customerId: number;
  customerName: string;
  orderDate: string; // ISO datetime
  statusCode: string; // OPEN | SENT_TO_BILLING | CANCELLED
  totalAmount: number;
  discountAmount: number;
  netAmount: number; // totalAmount - discountAmount
  paymentConditionId: number;
  bonusLines: number;
  deliveryStatusCode: string | null; // IN_ROUTE | DELIVERED | PARTIAL | REJECTED
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
  originCode: string; // FIELD | COUNTER
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
  originCode?: string; // FIELD | COUNTER — doc 30, sección 9.1
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
  originCode: string; // FIELD | COUNTER
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

export interface UpdateOrderCommand {
  paymentConditionId?: number | null; // null/omitido = no cambia
  catalogItems: OrderItemEditCommand[];
  predictedItems: OrderItemEditCommand[];
}

export interface PendingBonusLineView {
  lineNumber: number;
  productId: number;
  productName: string;
  quantity: number;
}

export interface PendingBonusOrderView {
  orderId: number;
  customerId: number;
  customerName: string;
  orderDate: string;
  pendingLines: PendingBonusLineView[];
}

// — Resumen global del día (admin), ver 24-panel-admin-... sección 7 —

export interface BrandSalesView {
  brandId: number;
  brandName: string;
  grossAmount: number; // subtotal de líneas no-bonus
  discountAmount: number; // descuento del pedido, prorrateado por marca
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
