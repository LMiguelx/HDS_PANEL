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

/**
 * `registeredBy*` — doc 31, sección 8.1/10: quién registró el último estado
 * del comprobante (la entrega o la última devolución). null mientras el
 * comprobante siga PENDING — nadie lo atendió todavía.
 */
export interface BatchItemView {
  lineNumber: number;
  invoiceId: string;
  customerName: string;
  amount: number;
  returnedAmount: number;
  netAmount: number;
  statusCode: string; // PENDING | DELIVERED | PARTIAL | REJECTED
  registeredByUserId: number | null;
  registeredByName: string | null;
  registeredAt: string | null; // ISO datetime
}

/**
 * Montos por integrante del equipo — pestaña "Equipo" (doc 31, sección 9).
 * `roleInTeam` null = atendió comprobantes de la planilla pero ya no figura
 * en el equipo actual (p. ej. un ayudante reemplazado); sus montos igual
 * se muestran.
 */
export interface MemberTotals {
  userId: number;
  fullName: string;
  roleInTeam: string | null; // DRIVER | HELPER | null
  invoices: number;
  amount: number;
  returnedAmount: number;
  netAmount: number; // lo que le corresponde rendir
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
  pendingAmount: number; // monto de los comprobantes que nadie atendió todavía
  memberTotals: MemberTotals[];
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

// ─────────────────────── Devoluciones por planilla (doc 36, sección 8) ───────────────────────

export interface BatchReturnProductView {
  productId: number;
  productCode: string;
  productName: string;
  unitOfMeasure: string;
  unitsPerPackage: number | null; // null si el producto no maneja paquetes
  returnedQuantity: number; // total devuelto, incluida la bonificación
  bonusQuantity: number; // de ese total, cuánto era bonificación
  fullPackages: number | null;
  looseUnits: number | null;
  returnedAmount: number;
  invoiceCount: number; // en cuántos comprobantes vuelve
}

export interface BatchReturnLineView {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  amount: number;
  reasonName: string;
  bonus: boolean; // true = bonificación recuperada, no una venta devuelta
}

export interface BatchReturnInvoiceView {
  lineNumber: number; // posición del comprobante en la planilla
  invoiceId: string;
  customerCode: string;
  customerName: string;
  statusCode: string; // PARTIAL | REJECTED — sección 3.3
  amount: number;
  returnedAmount: number;
  netAmount: number;
  registeredByUserId: number | null;
  registeredByName: string | null;
  registeredAt: string | null; // ISO datetime
  lines: BatchReturnLineView[];
}

export interface BatchReturnsReport {
  batchId: number;
  batchDate: string; // yyyy-MM-dd
  series: number;
  number: number;
  statusCode: string; // estado de la PLANILLA — OPEN | IN_ROUTE | SETTLED
  vehiclePlate: string | null;
  driverName: string | null;
  settledAt: string | null;
  totalInvoices: number;
  pendingInvoices: number; // de esos, cuántos siguen sin atender
  invoicesWithReturns: number;
  returnedAmount: number;
  returnedQuantity: number;
  productCount: number; // productos distintos devueltos
  products: BatchReturnProductView[]; // consolidado, ordenado por nombre
  invoices: BatchReturnInvoiceView[]; // comprobantes con devolución, en orden de planilla
}
