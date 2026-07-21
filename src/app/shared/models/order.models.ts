
export interface OrderSummary {
  orderId: number;
  customerId: number;
  customerName: string;
  orderDate: string; // ISO
  statusCode: string; // OPEN | SENT_TO_BILLING | CANCELLED
  totalAmount: number;
}

export interface OrderItemView {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  bonus: boolean;
}

export interface OrderDetail {
  orderId: number;
  customerId: number;
  customerName: string;
  orderDate: string;
  statusCode: string;
  paymentConditionName?: string | null;
  note?: string | null;
  totalAmount: number;
  promoDiscountTotal?: number | null;
  items: OrderItemView[];
}

// ── Creación ────────────────────────────────────────────────────────────
export interface SuggestedItem {
  productId: number;
  productName: string;
  purchaseCount: number;
  lastPurchasedAt: string;
  avgQuantity: number;
}

export interface CreateOrderItem {
  productId: number;
  quantity: number;
}
export interface CreateAllocationItem {
  allocationId: number;
  quantity: number;
}

export interface CreateOrderCommand {
  customerId: number;
  paymentConditionId: number;
  captureModeId: number;
  branchId?: number;
  visitId?: number;
  latitude?: number;
  longitude?: number;
  note?: string;
  idempotencyKey?: string;
  items: CreateOrderItem[];
  allocationItems?: CreateAllocationItem[];
}

export interface OrderCreatedResult {
  orderId: number;
  totalAmount: number;
  statusCode: string;
  duplicate: boolean;
  bonusLines: number;
  promoDiscountTotal: number;
}
