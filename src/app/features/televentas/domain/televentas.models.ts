// Contratos propios del modo televentas — doc 42 (42-panel-televentas-vendedor.md).
// Lo que ya existía para el pedido de mostrador, el mapa de asignaciones o el
// catálogo se reutiliza tal cual desde su archivo original (ver comentarios
// en cada servicio de data-access): acá solo lo que es nuevo de este doc.

import { BrandSalesView, OrderSummary } from '../../../shared/models/order.models';

/**
 * Lo que un pedido lleva de una marca — doc 51, sección 13.5. Solo líneas de
 * venta: las bonificaciones no suman monto.
 */
export interface OrderBrandView {
  brandId: number; // NO mostrar — para filtrar
  brandName: string;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  units: number;
}

/** Un pedido de la liquidación del día, con lo que lleva de cada marca — doc 51, sección 13.5. */
export type DailyOrderView = OrderSummary & { brands: OrderBrandView[] };
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
  orders: DailyOrderView[];
}

/** Una elección de premio dentro del `POST /api/orders` — doc 47, sección 13.1. */
export interface PromoChoiceCommand {
  promoId: number;
  tier: number;
  benefitGroup: number;
  benefitLines: number[];
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
  promoChoices?: PromoChoiceCommand[]; // doc 47, sección 13.1 — lo elegido del draft-choices
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

/**
 * POST /api/mobile/promos/draft-preview (progreso) y POST
 * /api/mobile/promos/draft-choices (premios a elegir) — mismo request, dos
 * endpoints y dos respuestas distintas (doc 47, sección 13.1).
 */
export interface DraftProgressCommand {
  customerId: number;
  paymentConditionId: number;
  lines: PreviewLineCommand[];
}

/** Opción de un premio a elegir mientras se arma el carrito — doc 47, sección 13.1. */
export interface MobileChoiceOptionView {
  benefitLine: number; // se devuelve en la elección
  benefitType: string;
  benefitTypeName: string;
  productId: number | null;
  productCode: string | null;
  productName: string | null;
  quantity: number | null;
  discountAmount: number | null;
  discountPercent: number | null;
  label: string | null;
  displayText: string;
  available: boolean; // NUEVO — doc 51, sección 13.3
  unavailableReason: string | null; // NUEVO — "Agotado: no hay stock suficiente" | null
}

/** Premio a elegir que gana el carrito antes de guardar — doc 47, sección 13.1. */
export interface MobileChoiceView {
  promoId: number; // se devuelve en la elección
  promoName: string;
  tier: number; // se devuelve en la elección
  benefitGroup: number; // se devuelve en la elección
  groupLabel: string | null;
  chooseCount: number; // cuántas elegir
  modeText: string; // "Elige 1 de 2"
  options: MobileChoiceOptionView[];
  soldOut: boolean; // NUEVO — doc 51, sección 13.3: no pide elegir, queda pendiente
}

/** POST /api/mobile/orders/{orderId}/promo-choices — doc 49, sección 10.3. */
export interface SaveOrderChoicesCommand {
  choices: PromoChoiceCommand[];
}

/** Opción de un premio del pedido, ya elegido o no — doc 49, sección 10.2. */
export interface MobileOrderChoiceOptionView {
  benefitLine: number; // se envía al elegir
  benefitType: string;
  benefitTypeName: string;
  productId: number | null;
  productCode: string | null;
  productName: string | null;
  quantity: number | null;
  discountAmount: number | null;
  discountPercent: number | null;
  label: string | null;
  displayText: string;
  chosen: boolean; // la opción elegida
  available: boolean; // NUEVO — doc 51, sección 13.4
  unavailableReason: string | null; // NUEVO
}

/** GET /api/mobile/orders/{orderId}/promo-choices — doc 49, sección 10.2. */
export interface MobileOrderChoiceView {
  promoId: number; // se devuelve al elegir
  promoName: string;
  tier: number; // se devuelve al elegir
  benefitGroup: number; // se devuelve al elegir
  groupLabel: string | null;
  chooseCount: number;
  modeText: string; // "Elige 1 de 2"
  status: string; // PENDING | CHOSEN | DECLINED
  statusLabel: string;
  chosenBenefitLines: number[]; // vacío salvo en CHOSEN
  editable: boolean; // se puede elegir o cambiar ahora
  options: MobileOrderChoiceOptionView[];
}
