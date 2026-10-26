// Contratos del simulador de pedido y promociones disponibles del cliente —
// doc 30 (panel-admin-pedido-mostrador-simulacion-reportes.md), secciones
// 7.7 y 10, con la promoción en prueba del doc 44, sección 9.2. El catálogo
// de promos disponibles (sobre `{ promos, products }`) es el del doc 49,
// sección 9.2 — reemplaza a la lista `MobilePromoView[]` que había antes.
// Escritos a mano: OrderSimulationController es nuevo.

export interface MobileConditionView {
  scope: string; // PRODUCT | FAMILY | BRAND
  scopeName: string; // mostrar: Producto | Familia | Marca
  targetId: number; // NO mostrar
  targetCode: string;
  targetName: string;
  productCount: number; // "10 productos"
  text: string; // "Marca: RINTI S.A.C."
}

export interface MobileBenefitView {
  benefitLine: number; // NO mostrar
  benefitType: string; // FREE_PRODUCT | DISCOUNT_AMOUNT | DISCOUNT_PERCENT
  productId: number | null;
  productCode: string | null;
  productName: string | null;
  quantity: number | null;
  discountAmount: number | null;
  discountPercent: number | null;
  label: string | null;
  text: string; // "2 BONIF. SAL MARINA *1KG gratis" | "2% de descuento"
}

export interface MobileBenefitGroupView {
  benefitGroup: number; // NO mostrar
  selectionMode: string; // ALL | CHOOSE
  chooseCount: number | null;
  modeText: string; // "Se entrega" | "Elige 1 de 2"
  benefits: MobileBenefitView[];
}

export interface MobileTierView {
  tier: number; // "Tramo N"
  threshold: number | null; // null en lista de clientes
  thresholdText: string; // "Desde S/ 190.00" | "Desde 1 unidad"
  rewardText: string;
  groups: MobileBenefitGroupView[];
}

/** Promoción disponible de un cliente, dentro del sobre `MobilePromoCatalogView` — doc 49, sección 9.2. */
export interface MobilePromoView {
  promoId: number; // NO mostrar
  name: string;
  featured: boolean; // insignia Destacada
  endDate: string | null; // null = sin fecha límite
  validUntilText: string; // "Hasta el 31 de octubre"
  measureType: string; // QUANTITY | AMOUNT
  scopeText: string; // "Marca RINTI S.A.C." | "Surtido de 4 productos"
  requirementText: string; // tramo de entrada
  rewardText: string; // premio del tramo de entrada
  requiresChoice: boolean;
  combinable: boolean;
  stackable: boolean; // false = no se combina con otras promociones
  repeats: boolean;
  maxRepeatsPerOrder: number | null;
  repeatText: string | null; // "Se repite hasta 3 veces por pedido"
  maxApplicationsPerCustomer: number | null;
  usesLeft: number | null; // null = sin tope
  usesText: string | null; // "Te queda 1 uso con este cliente"
  conditions: MobileConditionView[];
  productIds: number[]; // ya expandidos; datos en MobilePromoCatalogView.products
  tiers: MobileTierView[];
}

/** Cada producto UNA vez, aunque cuente para varias promociones — doc 49, sección 9.2. */
export interface MobilePromoProductView {
  productId: number; // NO mostrar: es la llave con productIds
  code: string;
  name: string;
  unitOfMeasure: string;
  unitsPerPackage: number;
  familyId: number; // para agrupar
  familyName: string;
  brandId: number; // para agrupar
  brandCode: string;
  brandName: string;
}

/** Sobre: las promociones y, una sola vez, los productos que cuentan para ellas. */
export interface MobilePromoCatalogView {
  totalAvailable: number; // todas las que le llegan al cliente hoy
  featuredCount: number; // cuántas de esas son destacadas
  featuredOnly: boolean; // si esta respuesta viene filtrada a destacadas
  promos: MobilePromoView[];
  products: MobilePromoProductView[];
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
  discountAmount: number; // doc 47, sección 12.1 — descuento real de ESTA línea
  netSubtotal: number; // subtotal - discountAmount
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
