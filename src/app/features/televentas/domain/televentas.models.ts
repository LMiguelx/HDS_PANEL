// Contratos propios del modo televentas — doc 42 (42-panel-televentas-vendedor.md).
// Lo que ya existía para el pedido de mostrador, el mapa de asignaciones o el
// catálogo se reutiliza tal cual desde su archivo original (ver comentarios
// en cada servicio de data-access): acá solo lo que es nuevo de este doc.

import { BrandSalesView, OrderSummary } from '../../../shared/models/order.models';
import { OrderItemCommand } from '../../../shared/models/counter-order.models';

/** GET /api/assignments/me/today-plan — quién le toca hoy y su asignación. */
export interface TodayStopView {
  customerId: number;
  assignmentId: number; // se envía al crear el pedido o la llamada
  assignmentType: string;
  frequencyType: string;
  effectiveFrom: string; // yyyy-MM-dd
  effectiveTo: string | null;
  weekdays: number[];
  weeksOfCycle: number[];
  isCoverage: boolean; // true = lo cubre hoy por ausencia de otro vendedor
  coverageId: number | null;
  onBehalfOfUserId: number | null;
  reason: string | null; // motivo de la cobertura
}

/** GET /api/routes/visit-reasons?visitStatusId= — motivos de No compró / Cerrado. */
export interface VisitReasonView {
  visitReasonId: number;
  visitStatusId: number;
  code: string;
  name: string;
}

/** POST /api/routes/visits — sección 8.3. El panel siempre envía remote: true, sin ubicación. */
export interface RegisterVisitCommand {
  assignmentId: number;
  visitStatusId: number; // 3 = No compró
  visitReasonId: number;
  remote: true;
}

export interface VisitView {
  visitId: number;
  routeId: number;
  customerId: number;
  visitStatusId: number;
  visitReasonId: number | null;
  visitedAt: string; // ISO datetime
  remote: boolean; // true = llamada
}

/**
 * GET /api/orders/my/daily-summary — liquidación del día del vendedor,
 * campo + televentas (sección 10). `salesByBrand`/`orders` reutilizan los
 * tipos ya existentes de order.models.ts.
 */
export interface DailyOrderSummaryView {
  date: string; // yyyy-MM-dd
  totalOrders: number; // incluye anulados; ningún monto los suma
  totalAmount: number;
  totalDiscountAmount: number;
  totalNetAmount: number;
  totalBonusLines: number;
  totalBonusUnits: number;
  salesByBrand: BrandSalesView[];
  orders: OrderSummary[];
}

/** POST /api/orders — sección 7.7. El panel siempre envía remote: true, sin ubicación. */
export interface CreateOrderCommand {
  assignmentId: number;
  paymentConditionId: number;
  note?: string; // máx. 255
  idempotencyKey: string; // máx. 36
  catalogItems: OrderItemCommand[];
  predictedItems: OrderItemCommand[];
  allocationItems: AllocationItemCommand[];
  remote: true;
}

export interface AllocationItemCommand {
  allocationId: number;
  quantity: number;
}

/** GET /api/prices/resolve — precio de una línea, con la escala por cantidad ya aplicada. */
export interface PriceResolved {
  productId: number;
  quantity: number;
  unitPrice: number;
  appliedMinQuantity: number | null;
  subtotal: number;
}

export interface PreviewLineCommand {
  productId: number;
  quantity: number;
}

/** POST /api/mobile/promos/draft-preview — solo progreso de promociones cerca de ganarse. */
export interface DraftProgressCommand {
  customerId: number;
  paymentConditionId: number;
  lines: PreviewLineCommand[];
}
