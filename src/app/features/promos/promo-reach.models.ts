// Alcance de promociones — doc 47, secciones 10 y 11. Los endpoints
// (/promos/{id}/reach, /reach/orders, /promos/reach-summary) todavía no
// están en el OpenAPI generado: se tipan a mano acá, como el resto de
// endpoints nuevos del panel (nunca se toca api.ts).

export type ReachChoiceStatus = 'CHOSEN' | 'PENDING' | 'DECLINED';

export interface ReachTotalsView {
  orderCount: number;
  customerCount: number;
  discountAmount: number;
  discountOrderCount: number;
  averageDiscountPerOrder: number;
  bonusUnits: number; // incluye las unidades de los sustitutos — doc 51, sección 14.2
  pendingChoices: number;
  declinedChoices: number; // solo premios a elegir declinados — doc 51, sección 14.1
  substitutedBonuses: number; // NUEVO — doc 51, sección 14.2
  declinedBonuses: number; // NUEVO — bonificaciones no otorgadas por falta de stock
  declinedBonusUnits: number; // NUEVO — unidades que no se entregaron
  lastAppliedAt: string | null;
}

export interface ReachTierRow {
  tier: number;
  thresholdText: string;
  orderCount: number;
}

export interface ReachSalespersonRow {
  salespersonId: number;
  salespersonCode: string;
  salespersonName: string;
  orderCount: number;
  discountAmount: number;
  bonusUnits: number;
}

/** `label` — doc 51, sección 14.3: mostrar en vez de `productName` cuando `substitute = true`. */
export interface ReachBonusProductRow {
  productId: number;
  productCode: string;
  productName: string;
  units: number;
  substitute: boolean; // NUEVO
  originalProductId: number | null; // NUEVO — NO mostrar
  originalProductCode: string | null; // NUEVO
  originalProductName: string | null; // NUEVO
  label: string; // NUEVO — "SAL DE MESA EMSAL *1KG (sustituto de SAL MARINA *1KG)"
}

export interface PromoReachView {
  promoId: number;
  code: string;
  name: string;
  measureType: 'QUANTITY' | 'AMOUNT' | string;
  startDate: string | null;
  endDate: string | null;
  statusLabel: string;
  from: string;
  to: string;
  salespersonId: number | null;
  totals: ReachTotalsView;
  byTier: ReachTierRow[];
  bySalesperson: ReachSalespersonRow[];
  bonusProducts: ReachBonusProductRow[];
}

export interface PromoReachOrderRow {
  orderId: number;
  orderDate: string;
  orderStatusCode: string;
  customerId: number;
  customerCode: string;
  customerName: string;
  salespersonId: number;
  salespersonCode: string;
  salespersonName: string;
  tier: number;
  discountAmount: number;
  bonusUnits: number;
  choiceStatus: ReachChoiceStatus | null;
  pendingApplicationId: number | null;
  substitutedBonuses: number; // NUEVO — doc 51, sección 14.4
  declinedBonuses: number; // NUEVO
}

export interface PromoReachSummaryRow {
  promoId: number;
  code: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  statusLabel: string;
  orderCount: number;
  customerCount: number;
  discountAmount: number;
  bonusUnits: number;
}

export interface PromoReachComparison {
  from: string;
  to: string;
  promos: PromoReachSummaryRow[];
}
