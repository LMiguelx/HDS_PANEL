// Contratos de Clientes. Se agrega customerTypeId (lo pide /prices/resolve).
// Confirma/regenera con openapi-typescript contra el Swagger real.

import { UbigeoView } from './customer-request.models';

/**
 * Cartera del vendedor logueado (GET /customers/portfolio, GET
 * /customers/portfolio/coverage) — doc 42, sección 6.1. `visitStatusCode`
 * es el de HOY (`PENDING` si no hubo visita); `hasOrderInCycle`, si ya
 * compró en las 4 semanas del ciclo en curso.
 */
export interface CustomerSummary {
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
  hasOrderInCycle: boolean;
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

/**
 * El vendedor del cliente hoy y cuándo lo visita — doc 33, sección 5.3.
 * `assignmentId` lo usan "Editar horario"/"Completar horario". `weekdays`/
 * `weeksOfCycle` pueden venir vacíos (horario incompleto, sección 3.4).
 */
export interface CustomerSalesAssignment {
  assignmentId: number;
  salespersonId: number;
  salespersonCode: string;
  salespersonName: string;
  effectiveFrom: string; // yyyy-MM-dd
  weekdays: number[]; // 1-7, ordenados
  weeksOfCycle: number[]; // 1-4, ordenados
}

export interface CustomerDetail {
  customerId: number;
  code: string;
  businessName: string;
  /** NUEVO (doc 70) — preselecciona el select del modal "Editar datos". */
  documentTypeId: number | null;
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
  hasOrderInCycle: boolean; // ya compró en la semana del ciclo en curso
  /** null si el cliente nunca compró. */
  metrics: PurchaseMetrics | null;
  /** NUEVO (doc 33) — null si el cliente no tiene vendedor asignado. */
  salesAssignment: CustomerSalesAssignment | null;
  /** NUEVO (doc 39) — null en clientes anteriores al cambio. */
  ubigeo: UbigeoView | null;
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

/** GET /admin/customers/edit-options (doc 70, sección 1.1) — catálogos del modal "Editar datos". */
export interface EditCustomerDocumentTypeOption {
  documentTypeId: number;
  code: string;
  name: string;
  validationPattern: string | null;
}

export interface EditCustomerCustomerTypeOption {
  customerTypeId: number;
  code: string;
  name: string;
}

export interface CustomerEditOptions {
  documentTypes: EditCustomerDocumentTypeOption[];
  customerTypes: EditCustomerCustomerTypeOption[];
}

/** PATCH /admin/customers/{id} (doc 70, sección 1.1) — solo se envían los campos que cambiaron. */
export interface EditCustomerCommand {
  businessName?: string;
  documentTypeId?: number;
  documentNumber?: string;
  customerTypeId?: number;
}

/** POST /admin/customers (doc 74, sección 2.2) — asignación inicial, opcional. */
export interface InitialSalesAssignment {
  userId: number;
  weekdays: number[]; // 1-7, al menos uno
  weeksOfCycle: number[] | null; // null o vacío = las 4 semanas
}

/** POST /admin/customers (doc 74, sección 2.2) — cliente completo, igual que en el ERP. */
export interface CreateCustomerCommand {
  customerCode: string;
  routeSequence: number;
  businessName: string;
  documentTypeId: number;
  documentNumber: string;
  customerTypeId: number;
  address: string;
  businessActivity: string | null;
  phone: string;
  latitude: number;
  longitude: number;
  ubigeoCode: string;
  salesAssignment: InitialSalesAssignment | null;
}

/** Respuesta 201 de POST /admin/customers (doc 74, sección 2.2). */
export interface CreateCustomerResult {
  customer: CustomerDetail;
  approvedRequestId: number | null;
  approvedRequestRequestedByName: string | null;
}
