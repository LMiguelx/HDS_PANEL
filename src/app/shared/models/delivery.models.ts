// Contratos de Planillas de reparto y Devoluciones (/api/deliveries). Ver
// 16-panel-supervision-reparto-facturas.md. Las planillas y sus líneas nacen
// en el ERP externo — el backend solo las lee y actualiza equipo/estado.

export interface BatchSummary {
  batchId: number;
  batchDate: string; // yyyy-MM-dd
  series: number;
  number: number;
  deliveryTeamId: number | null; // null = sin equipo asignado
  vehiclePlate: string | null;
  statusCode: string; // OPEN | IN_ROUTE | SETTLED
  totalAmount: number;
  totalWeight: number;
  totalItems: number;
  pendingItems: number;
}

export interface BatchListFilters {
  page?: number;
  size?: number;
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
  deliveryTeamId: number | null;
  vehiclePlate: string | null;
  driverName: string | null;
  statusCode: string;
  totalAmount: number;
  totalWeight: number;
  settledAt: string | null; // ISO datetime
  items: BatchItemView[];
}

export interface BatchCustomerView {
  customerId: number;
  code: string;
  businessName: string;
  documentNumber: string;
  address: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  invoiceId: string;
  amount: number;
  itemStatusCode: string; // PENDING | DELIVERED | PARTIAL | REJECTED
}

export interface AssignTeamCommand {
  deliveryTeamId: number;
}

export interface ReturnView {
  returnId: number;
  invoiceId: string;
  productId: number;
  productName: string;
  quantity: number;
  amount: number;
  returnReasonId: number;
  reasonName: string;
  registeredBy: number;
  registeredAt: string; // ISO datetime
  salespersonNotified: boolean;
}

export interface ReturnReasonView {
  returnReasonId: number;
  code: string;
  name: string;
}
