export interface BatchSummary {
  batchId: number;
  batchDate: string;
  series: number;
  number: number;
  deliveryTeamId: number;
  vehiclePlate: string;
  statusCode: string; // OPEN | IN_ROUTE | SETTLED
  totalAmount: number;
  totalWeight: number;
  totalItems: number;
  pendingItems: number;
}

export interface BatchItemView {
  lineNumber: number;
  invoiceId: string;
  customerName: string;
  amount: number;
  statusCode: string; // PENDING | DELIVERED | PARTIAL | REJECTED
}

export interface BatchDetail {
  batchId: number;
  batchDate: string;
  series: number;
  number: number;
  deliveryTeamId: number;
  vehiclePlate: string;
  driverName: string;
  statusCode: string;
  totalAmount: number;
  totalWeight: number;
  settledAt: string | null;
  items: BatchItemView[];
}

export interface CreateBatchCommand {
  branchId: number;
  batchDate?: string;
  series: number;
  deliveryTeamId: number;
  invoiceIds: string[];
}

// ── Marcado / devoluciones ────────────────────────────────────────────────
export interface MarkItemCommand {
  invoiceId: string;
  status: string; // DELIVERED | PARTIAL | REJECTED
}

export interface ReturnReasonView {
  returnReasonId: number;
  code: string;
  name: string;
}

export interface CreateReturnCommand {
  invoiceId: string;
  productId: number;
  quantity: number;
  amount: number;
  returnReasonId: number;
}

export interface ReturnView {
  returnId?: number;
  invoiceId: string;
  productId: number;
  productName?: string | null;
  quantity: number;
  amount: number;
  returnReasonName?: string | null;
  createdAt?: string | null;
}
