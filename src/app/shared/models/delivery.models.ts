// Contratos de Planillas de reparto y Devoluciones (/api/deliveries). Ver
// 16-panel-supervision-reparto-facturas.md. Las planillas y sus líneas nacen
// en el ERP externo — el backend solo las lee y actualiza equipo/estado.
//
// `chargeAmount`/`amountToCollect` — doc 53: descuento perdido por
// devolución y lo que realmente hay que cobrar (`netAmount + chargeAmount`).
// Siempre llegan (nunca opcionales); el panel no los recalcula.

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
  driverName: string | null; // doc 50, sección 5.3 — "placa · conductor" en el inicio de reparto
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
  chargeAmount: number; // doc 53 — descuento perdido de toda la planilla
  amountToCollect: number; // doc 53 — netAmount + chargeAmount
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
  chargeAmount: number; // doc 53 — 0 si el cliente no perdió descuento
  amountToCollect: number; // doc 53 — netAmount + chargeAmount
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
  netAmount: number; // lo que le corresponde rendir, como figura en el ERP
  chargeAmount: number; // doc 53 — descuento perdido de SUS comprobantes
  amountToCollect: number; // doc 53 — lo que le toca rendir de verdad
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
  chargeAmount: number; // doc 53 — tarjeta "Descuento perdido"
  amountToCollect: number; // doc 53 — tarjeta "A cobrar"
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
  routeSequence: number | null;
  invoiceId: string;
  amount: number;
  returnedAmount: number;
  netAmount: number;
  itemStatusCode: string; // PENDING | DELIVERED | PARTIAL | REJECTED
  registeredByUserId: number | null;
  registeredByName: string | null;
  registeredAt: string | null; // ISO datetime
  chargeAmount: number; // doc 53
  amountToCollect: number; // doc 53
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

/** Descuento que el cliente pierde en una línea por una promoción — doc 53, sección 11.2. */
export interface DiscountChargeView {
  promoId: number; // NO mostrar
  promoName: string;
  productId: number; // NO mostrar
  productCode: string;
  productName: string;
  orderDiscount: number; // "Descuento del pedido"
  keptDiscount: number; // "Quedaba tras devolver"
  currentDiscount: number; // "Le corresponde ahora"
  chargeAmount: number; // "A cobrar" = keptDiscount - currentDiscount
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
  chargeAmount: number; // doc 53
  amountToCollect: number; // doc 53
  discounts: DiscountChargeView[]; // doc 53 — vacío si no perdió descuentos
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
  chargeAmount: number; // doc 53 — descuento perdido de la planilla
}

// ─────────────────────── Promociones del comprobante (doc 53, sección 12) ───────────────────────

export interface BenefitInsight {
  benefitType: string; // FREE_PRODUCT | DISCOUNT_PERCENT | DISCOUNT_AMOUNT (sección 4.3)
  productId: number | null; // NO mostrar
  productName: string | null;
  quantity: number | null;
  discountAmount: number | null;
  discountPercent: number | null;
  label: string;
}

export interface TierInsight {
  tier: number;
  fromQuantity: number | null;
  fromAmount: number | null;
  thresholdText: string;
  benefits: BenefitInsight[];
}

/** Bonificación que el cliente conserva. `originalProductId` con valor = es un sustituto (doc 51). */
export interface GrantedInsight {
  productId: number; // NO mostrar
  productName: string;
  quantity: number;
  originalProductId: number | null; // NO mostrar
  originalProductName: string | null;
}

/** Descuento que el cliente conserva en un producto. */
export interface DiscountInsight {
  productId: number; // NO mostrar
  productName: string;
  amount: number;
}

export interface PromoInsight {
  promoId: number; // NO mostrar
  promoName: string;
  measureType: string; // QUANTITY | AMOUNT (sección 4.4)
  tiers: TierInsight[];
  currentMeasured: number;
  currentTier: number | null; // null = ningún tramo alcanzado hoy
  currentlyGranted: GrantedInsight[];
  currentDiscounts: DiscountInsight[]; // doc 53
  chargeAmount: number; // doc 53 — descuento perdido de esta promoción
}
