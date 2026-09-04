// Contratos de Clientes. Se agrega customerTypeId (lo pide /prices/resolve).
// Confirma/regenera con openapi-typescript contra el Swagger real.

export interface CustomerSummary {
  customerId: number;
  businessName: string;
  documentNumber: string;
  address: string | null;
  customerTypeId?: number | null;
  customerTypeName: string | null;
  active: boolean;
}

/** Ver 13-panel-admin-clientes-solicitudes-cobertura-mapa.md — mismo GET /api/customers/{id} que usa el detalle de cartera y el clic en un punto del mapa de Asignaciones. */
export interface PurchaseMetrics {
  lastPurchaseDate: string | null; // yyyy-MM-dd
  ordersLast30d: number;
  ordersLast90d: number;
  ordersLast365d: number;
  amountLast30d: number;
  amountLast90d: number;
  amountLast365d: number;
  avgDaysBetweenOrders: number | null;
}

export interface CustomerDetail {
  customerId: number;
  code: string;
  businessName: string;
  documentTypeName: string | null;
  documentNumber: string;
  customerTypeId: number | null;
  customerTypeName: string | null;
  address: string | null;
  businessActivity: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  creditUsed: number;
  rating: number | null; // 1-5, null = sin calificar
  isActive: boolean;
  /** null si el cliente nunca compró. */
  metrics: PurchaseMetrics | null;
}

export interface CustomerInvoiceSummary {
  invoiceId: string;
  issueDate: string;
  totalAmount: number;
  matchStatus: string;
}

/** Fila del buscador admin (GET /api/admin/customers) — distinto de CustomerSummary
 * (cartera del vendedor logueado): mismo nombre en el backend, DTO distinto, así que
 * se renombra acá para no chocar con el tipo ya usado por CustomerService.portfolio()/.search(). */
export interface AdminCustomerSummary {
  customerId: number;
  code: string;
  businessName: string;
  documentNumber: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  routeSequence: number | null;
  visitStatusCode: string | null;
  visitStatusName: string | null;
  rating: number | null;
}

export interface AdminCustomerFilters {
  q?: string;
  onlyActive?: boolean;
  page?: number;
  size?: number;
  sort?: string;
}

export interface RateCustomerCommand {
  rating: number; // obligatorio, 1-5
}
