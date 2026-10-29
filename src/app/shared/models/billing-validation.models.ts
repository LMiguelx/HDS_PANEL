// Contratos de Validación y envío de pedidos a facturación — doc 32
// (32-panel-admin-validacion-envio-facturacion.md). Escritos a mano: los
// endpoints son nuevos y `api.ts` (generado) todavía no los incluye.

/**
 * Dos formas de uso (sección 6.2): con `orderIds` se validan esos pedidos
 * (máx. 200) y `date`/`page`/`size` se ignoran; sin `orderIds` se valida la
 * página indicada de los abiertos de `date` (null = hoy).
 */
export interface ValidateBillingCommand {
  date?: string; // yyyy-MM-dd — solo se usa si NO llegan orderIds
  orderIds?: number[]; // máximo 200
  page?: number; // solo se usa si NO llegan orderIds
  size?: number; // 1 a 200, default 200 — solo si NO llegan orderIds
}

/** Grupo de verificación — siempre los seis, en este orden (sección 3.2). */
export interface BillingGroupCheck {
  group: string; // ORDER | CUSTOMER | PRODUCTS | PRICES | TOTALS | PROMOS
  groupName: string; // listo para mostrar
  passed: boolean;
}

/** Un motivo por el que un pedido no pasó algún grupo (sección 3.3). */
export interface BillingIssue {
  group: string;
  code: string;
  message: string; // texto listo para mostrar
  lineNumber: number | null; // solo si el motivo es de una línea
  productId: number | null;
  productName: string | null;
}

export interface OrderBillingValidation {
  orderId: number;
  orderDate: string; // ISO datetime
  statusCode: string; // sección 3.1
  originCode: string; // FIELD | COUNTER
  customerId: number;
  customerName: string;
  salespersonId: number;
  salespersonName: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  lineCount: number;
  valid: boolean; // true = se puede enviar
  checks: BillingGroupCheck[]; // siempre los seis grupos
  issues: BillingIssue[]; // vacía si valid = true
  /**
   * doc 55 — sus motivos se corrigen con "Recalcular promociones". Lo
   * calcula el servidor; el panel nunca lo deduce de `issues`. Un pedido
   * válido siempre trae `false`.
   */
  recalculable: boolean;
}

/** `POST /orders/billing/recalculate` — doc 55, sección 6. De 1 a 100 ids, sin repetir. */
export interface RecalculateBillingCommand {
  orderIds: number[];
}

/** `reasonCode` — doc 55, sección 4.2. Solo llega cuando `recalculated = false`. */
export interface OrderRecalculationOutcome {
  orderId: number;
  customerName: string | null; // null si NOT_FOUND
  recalculated: boolean;
  reasonCode: string | null; // ALREADY_VALID | NOT_OPEN | NOT_RECALCULABLE | NOT_FOUND | BLOCKED | ERROR
  reason: string | null; // listo para mostrar
}

export interface BillingRecalculationResult {
  requested: number;
  recalculatedCount: number;
  notRecalculatedCount: number;
  orders: OrderRecalculationOutcome[]; // mismo orden que orderIds
  validation: BillingValidationResult; // la tanda REVALIDADA después de recalcular
}

export interface BillingValidationResult {
  date: string | null; // null si se validó por orderIds
  page: number;
  size: number;
  totalElements: number; // por fecha: abiertos de ese día. Por ids: cuántos se pidieron
  totalPages: number; // por fecha: páginas a pedir. Por ids: 1
  validCount: number; // válidos de ESTA tanda
  invalidCount: number; // con motivos de ESTA tanda
  notFoundOrderIds: number[]; // ids pedidos que no existen o no se pueden ver
  orders: OrderBillingValidation[];
}

/** Obligatorio — de 1 a 100 pedidos por llamada (sección 8.2). */
export interface SendBillingCommand {
  orderIds: number[];
}

/** `reasonCode` — sección 3.4. Solo llega cuando `sent = false`. */
export interface OrderBillingSendOutcome {
  orderId: number;
  customerName: string | null; // null si el pedido no se encontró
  netAmount: number | null;
  sent: boolean;
  reasonCode: string | null; // VALIDATION_FAILED | ORDER_CHANGED | BLOCKED | NOT_FOUND | ERROR
  reason: string | null; // texto listo para mostrar
  issues: BillingIssue[]; // solo con VALIDATION_FAILED
}

export interface BillingSendResult {
  requested: number;
  sentCount: number;
  notSentCount: number;
  orders: OrderBillingSendOutcome[];
}
