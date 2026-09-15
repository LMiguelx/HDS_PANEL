// Contratos de Pedidos (/orders). Ver documentacion-endpoints-pedidos.md.
// Solo los 4 endpoints GET documentados (consulta/supervisión) — creación,
// envío a facturación y anulación no están en este documento, quedan fuera
// de alcance de este panel hasta que se confirmen.

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

export interface OrderListFilters {
  customerId?: number;
  salespersonId?: number;
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

export interface OrderDetail {
  orderId: number;
  customerId: number;
  customerName: string;
  salespersonId: number;
  paymentConditionId: number;
  statusCode: string;
  orderDate: string;
  note: string | null;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  sentToBillingAt: string | null;
  items: OrderItemView[];
  deliveryStatus: DeliveryStatusView | null;
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
