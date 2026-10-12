// Contratos del simulador de pedido y promociones disponibles del cliente —
// doc 30 (panel-admin-pedido-mostrador-simulacion-reportes.md), secciones
// 7.7 y 10. Escritos a mano: OrderSimulationController es nuevo.
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
}
