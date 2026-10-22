// Contratos del simulador de pedido y promociones disponibles del cliente —
// doc 30 (panel-admin-pedido-mostrador-simulacion-reportes.md), secciones
// 7.7 y 10, con la promoción en prueba del doc 44, sección 9.2. Escritos a
// mano: OrderSimulationController es nuevo.
import { ConditionView } from '../../features/promos/promo.types';

export interface MobilePromoView {
  promoId: number;
  name: string;
  requirementText: string; // "Lleva 10 gaseosas (puedes combinar)"
  rewardText: string; // "1 Inca Kola 500ml gratis"
  validUntilText: string; // "Hasta el 30 de setiembre"
  requiresChoice: boolean;
  measureType: string; // QUANTITY | AMOUNT
  minQuantity: number | null;
  minAmount: number | null;
  combinable: boolean;
  appliesTo: ConditionView[];
}

export interface SimulateLineCommand {
  productId: number;
  quantity: number; // mínimo 0.001
}

export interface SimulateOrderCommand {
  customerId: number;
  paymentConditionId: number;
  salesChannelId: number; // 0 = sin canal
  lines: SimulateLineCommand[];
  promoId?: number; // doc 44 — promoción en prueba: se evalúa aunque esté apagada o fuera de fecha
}

export interface SimulatedLineView {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number; // ya con la escala por cantidad
  subtotal: number;
}

export interface SimulatedBenefitView {
  benefitType: string; // FREE_PRODUCT | DISCOUNT_AMOUNT | DISCOUNT_PERCENT
  benefitTypeName: string;
  productId: number | null;
  productName: string | null;
  productCode: string | null;
  quantity: number | null;
  discountAmount: number | null; // soles que descuenta de ESTE pedido
  discountPercent: number | null;
  label: string | null;
  displayText: string; // "1 x GALLETA SODA X6"
}

export interface SimulatedChoiceView {
  groupLabel: string; // "Elige tu premio"
  chooseCount: number;
  options: SimulatedBenefitView[];
}

export interface SimulatedPromoView {
  promoId: number;
  promoName: string;
  granted: SimulatedBenefitView[];
  pendingChoices: SimulatedChoiceView[];
}

export interface MobilePromoProgressView {
  promoId: number;
  name: string;
  earned: boolean; // en nearPromos siempre false
  progressText: string; // "Te faltan 2 unidades para ganar 1 Aceite Primor 1L"
  currentMeasure: number;
  targetMeasure: number;
  percentComplete: number; // 50 a 99
  rewardText: string;
}

/** La promoción en prueba, gane o no — doc 44, sección 9.2. */
export interface TestedPromoView {
  promoId: number;
  promoCode: string;
  promoName: string;
  active: boolean; // false: insignia "Apagada · en prueba"
  startDate: string | null; // "Empieza el dd/MM/yyyy" si es futura
  endDate: string | null;
  eligible: boolean; // ¿le llega a este cliente con este canal?
  notEligibleReason: string | null; // motivo claro, listo para mostrar (null si eligible)
  earned: boolean; // ¿el pedido la gana?
  measureType: 'QUANTITY' | 'AMOUNT';
  measuredValue: number; // cuánto midió el pedido (unidades o soles)
  nextThreshold: number | null; // umbral del siguiente tramo (o del primero)
  missingForNextTier: number | null; // cuánto falta para ese tramo
  progressText: string; // "Te faltan 2 unidades para 1 x BONIF. PLATO MAXICAT"
}

export interface OrderSimulationView {
  customerId: number;
  customerCode: string;
  customerName: string;
  salesChannelId: number;
  totalAmount: number; // bruto
  discountAmount: number;
  netAmount: number; // lo que pagaría el cliente
  bonusLines: number;
  pendingChoiceCount: number;
  lines: SimulatedLineView[];
  appliedPromos: SimulatedPromoView[];
  nearPromos: MobilePromoProgressView[];
  testedPromo: TestedPromoView | null; // doc 44 — null si no se envió promoId
}
