// Contratos de Planillas de reparto y Devoluciones (/api/deliveries). Ver
// 16-panel-supervision-reparto-facturas.md. Las planillas y sus líneas nacen
// en el ERP externo — el backend solo las lee y actualiza equipo/estado.

export interface ItemStatusCounts {
  pending: number;
  delivered: number;
  partial: number;
  rejected: number;
}

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
  returnedAmount: number; // monto total devuelto de la planilla
  netAmount: number; // totalAmount - returnedAmount
  returnedQuantity: number; // unidades devueltas
  returnedProductCount: number; // productos distintos devueltos
  totalItems: number;
  statusCounts: ItemStatusCounts;
  itemsProgressPercentage: number; // (delivered+partial+rejected)/totalItems * 100
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
  returnedAmount: number;
  netAmount: number;
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
  returnedAmount: number;
  netAmount: number;
  returnedQuantity: number;
  returnedProductCount: number;
  itemsProgressPercentage: number;
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
  // El ERP no siempre manda coordenadas — el mapa debe tratar esto como caso
  // normal, no como error (lista aparte de "sin ubicación").
  latitude: number | null;
  longitude: number | null;
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
