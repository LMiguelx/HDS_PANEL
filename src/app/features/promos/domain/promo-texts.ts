// Textos de promoción que arma el panel — doc 44, sección 10. El backend
// manda algunos ya armados (thresholdText, displayText, modeText), pero en
// detalle/asistente/simulación se arman aquí para mostrar los códigos y
// cuidar la gramática. Única fuente: nunca se repiten en cada pantalla.
import { formatSoles } from '../../../shared/pipes/money';
import { quantityText } from '../../sales-reports/sales-report-format';

export type MeasureTypeCode = 'QUANTITY' | 'AMOUNT' | string | null | undefined;
export type BenefitTypeCode =
  'FREE_PRODUCT' | 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENT' | string | null | undefined;
export type SelectionModeCode = 'ALL' | 'CHOOSE' | string | null | undefined;
export type ScopeCode = 'PRODUCT' | 'FAMILY' | 'BRAND' | string | null | undefined;

/** "Desde 1 unidad" · "Desde 10 unidades" · "Desde S/ 1,234.56" · "Por estar en la lista". */
export function thresholdText(opts: {
  promoType?: string | null;
  measureType?: MeasureTypeCode;
  fromQuantity?: number | null;
  fromAmount?: number | null;
}): string {
  if (opts.promoType === 'CUSTOMER_LIST') return 'Por estar en la lista';
  if (opts.measureType === 'AMOUNT') {
    return opts.fromAmount != null ? `Desde ${formatSoles(opts.fromAmount)}` : '—';
  }
  if (opts.fromQuantity == null) return '—';
  return opts.fromQuantity === 1
    ? 'Desde 1 unidad'
    : `Desde ${quantityText(opts.fromQuantity)} unidades`;
}

/**
 * "{cantidad} × {código} {nombre}" de un premio de producto, o el texto del
 * descuento. Nunca concatena `null`/`undefined`: siempre tiene respaldo.
 */
export function benefitText(b: {
  benefitType?: BenefitTypeCode;
  quantity?: number | null;
  productCode?: string | null;
  productName?: string | null;
  label?: string | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
}): string {
  if (b.benefitType === 'DISCOUNT_AMOUNT') {
    return `${formatSoles(b.discountAmount ?? 0)} de descuento`;
  }
  if (b.benefitType === 'DISCOUNT_PERCENT') {
    return `${b.discountPercent ?? 0}% de descuento`;
  }
  const qty = quantityText(b.quantity ?? 1);
  const name =
    b.productCode && b.productName
      ? `${b.productCode} ${b.productName}`
      : (b.productName ?? b.label ?? 'Premio sin nombre');
  return `${qty} × ${name}`;
}

/** "Recibe todo" · "El cliente elige {chooseCount} de {n}" — doc 47, sección 4.3 (texto del asistente). */
export function groupModeText(
  selectionMode: SelectionModeCode,
  chooseCount: number | null | undefined,
  optionsCount: number,
): string {
  if (selectionMode === 'CHOOSE') return `El cliente elige ${chooseCount ?? 1} de ${optionsCount}`;
  return 'Recibe todo';
}

/** Insignia de tabla — doc 47, sección 4.3: "Siempre" (verde) · "Elige {chooseCount} de {n}". */
export function groupModeBadgeText(
  selectionMode: SelectionModeCode,
  chooseCount: number | null | undefined,
  optionsCount: number,
): string {
  if (selectionMode === 'CHOOSE') return `Elige ${chooseCount ?? 1} de ${optionsCount}`;
  return 'Siempre';
}

/** "Producto {código} {nombre}" · "Familia {nombre}" · "Marca {nombre}". */
export function conditionText(c: {
  scope?: ScopeCode;
  productCode?: string | null;
  productName?: string | null;
  familyName?: string | null;
  brandName?: string | null;
}): string {
  if (c.scope === 'FAMILY') return `Familia ${c.familyName ?? 'sin nombre'}`;
  if (c.scope === 'BRAND') return `Marca ${c.brandName ?? 'sin nombre'}`;
  return c.productCode ? `Producto ${c.productCode} ${c.productName ?? ''}`.trimEnd() : 'Producto';
}

/** Columna "Premio" de la tabla de tramos (solo nombre, sin cantidad) — sección 6.2. */
export function benefitProductName(b: {
  benefitType?: BenefitTypeCode;
  productName?: string | null;
  label?: string | null;
}): string {
  if (b.benefitType === 'DISCOUNT_AMOUNT' || b.benefitType === 'DISCOUNT_PERCENT') return '—';
  return b.productName ?? b.label ?? 'Premio sin nombre';
}

/** Columna "Valor" de la tabla de tramos: unidades, soles o porcentaje según el tipo — doc 47, sección 4.2. */
export function benefitQuantityText(b: {
  benefitType?: BenefitTypeCode;
  quantity?: number | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
}): string {
  if (b.benefitType === 'DISCOUNT_AMOUNT') return formatSoles(b.discountAmount ?? 0);
  if (b.benefitType === 'DISCOUNT_PERCENT') return `${b.discountPercent ?? 0}%`;
  return `${quantityText(b.quantity ?? 0)} und`;
}

function isDiscountBenefit(b: { benefitType?: BenefitTypeCode }): boolean {
  return b.benefitType === 'DISCOUNT_AMOUNT' || b.benefitType === 'DISCOUNT_PERCENT';
}

/** "{a}, {b} y {c}" — une una lista de frases cortas en español, sin Oxford comma. */
function joinWithY(parts: string[]): string {
  const clean = parts.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} y ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} y ${clean[clean.length - 1]}`;
}

type ConditionLike = {
  scope?: ScopeCode;
  productCode?: string | null;
  productName?: string | null;
  familyName?: string | null;
  brandName?: string | null;
};

function singleWhatCountsText(c: ConditionLike): string {
  if (c.scope === 'BRAND') return `todos los productos de ${c.brandName ?? 'la marca'}`;
  if (c.scope === 'FAMILY') {
    return `todos los productos de la familia ${c.familyName ?? 'sin nombre'}`;
  }
  return c.productCode
    ? `${c.productCode} ${c.productName ?? ''}`.trimEnd()
    : (c.productName ?? 'el producto');
}

/**
 * "Qué cuenta" — doc 47, sección 5.4: marca/familia completas, un producto,
 * varios productos ("{n} productos") o, si mezclan alcances, la lista unida.
 */
export function whatCountsText(conditions: ConditionLike[], promoType?: string | null): string {
  if (promoType === 'CUSTOMER_LIST') return 'la lista de clientes';
  if (conditions.length === 0) return 'cualquier compra';
  if (conditions.length === 1) return singleWhatCountsText(conditions[0]);
  if (conditions.every((c) => c.scope === 'PRODUCT')) return `${conditions.length} productos`;
  return joinWithY(conditions.map(singleWhatCountsText));
}

/** "Cómo se cuenta" — doc 47, sección 5.4. */
export function measureModeText(
  measureType: MeasureTypeCode,
  conditions: ConditionLike[],
  promoType?: string | null,
): string {
  const qc = whatCountsText(conditions, promoType);
  return measureType === 'AMOUNT'
    ? `Se suma el importe de ${qc}, a su precio de lista`
    : `Se suman las unidades de ${qc}`;
}

/** "Desde S/ 190.00" sin el prefijo "Desde", con "o más" — para la frase del tramo (sección 5.4). */
export function thresholdOrMoreText(opts: {
  measureType?: MeasureTypeCode;
  fromQuantity?: number | null;
  fromAmount?: number | null;
}): string {
  if (opts.measureType === 'AMOUNT') {
    return opts.fromAmount != null ? `${formatSoles(opts.fromAmount)} o más` : '—';
  }
  if (opts.fromQuantity == null) return '—';
  return opts.fromQuantity === 1
    ? '1 unidad o más'
    : `${quantityText(opts.fromQuantity)} unidades o más`;
}

/** "en esos productos" · "en todo el pedido" — alcance del descuento (sección 5.4). */
export function discountScopeText(promoType?: string | null): string {
  return promoType === 'CUSTOMER_LIST' ? 'en todo el pedido' : 'en esos productos';
}

type BenefitLike = {
  benefitType?: BenefitTypeCode;
  quantity?: number | null;
  productCode?: string | null;
  productName?: string | null;
  label?: string | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
};

/** "{n} unidad" · "{n} unidades", sin cero sobrante — base de los textos de obligatoriedad. */
function unitsPhrase(n: number): string {
  return `${quantityText(n)} unidad${n === 1 ? '' : 'es'}`;
}

/** Columna "Obligatorio" del resumen (paso 5) — doc 57, sección 7: "Al menos {n} unidad(es)". */
export function minQuantityText(minQuantity: number): string {
  return `Al menos ${unitsPhrase(minQuantity)}`;
}

/**
 * Insignia de una condición obligatoria — doc 57, sección 4.2: el servidor
 * manda `requiredText` ya armado en `ConditionView`; esta función arma el
 * mismo texto para la vista previa local del asistente (sección 0.4: el
 * panel arma sus propios textos de ayuda).
 */
export function requiredConditionText(minQuantity: number): string {
  return `Obligatorio: al menos ${unitsPhrase(minQuantity)}`;
}

type RequiredConditionLike = { minQuantity: number; condition: ConditionLike };

/** "incluyendo al menos 1 unidad de X y 2 de Y" — doc 57, sección 6.4. */
function requiredInlineText(required: RequiredConditionLike[]): string {
  if (required.length === 0) return '';
  const parts = required.map(
    (r) => `al menos ${unitsPhrase(r.minQuantity)} de ${singleWhatCountsText(r.condition)}`,
  );
  return `incluyendo ${joinWithY(parts)}`;
}

/**
 * Frase del tramo / frase de lista de clientes — doc 47, sección 5.4:
 * "Si compra {umbral} o más de {qué cuenta}, recibe {premios}{alcance si hay
 * descuento}" · "Por estar en la lista, el cliente recibe {premios} en todo
 * el pedido". `requiredConditions` — doc 57, sección 6.4: líneas obligatorias
 * del surtido, agregadas al final de la frase.
 */
export function tierPhraseText(opts: {
  promoType?: string | null;
  measureType?: MeasureTypeCode;
  fromQuantity?: number | null;
  fromAmount?: number | null;
  conditions: ConditionLike[];
  benefits: BenefitLike[];
  requiredConditions?: RequiredConditionLike[];
}): string {
  const premios = joinWithY(opts.benefits.map((b) => benefitText(b))) || 'premios por definir';
  if (opts.promoType === 'CUSTOMER_LIST') {
    return `Por estar en la lista, el cliente recibe ${premios} en todo el pedido.`;
  }
  const umbral = thresholdOrMoreText(opts);
  const qc = whatCountsText(opts.conditions, opts.promoType);
  const hasDiscount = opts.benefits.some(isDiscountBenefit);
  const alcance = hasDiscount ? ` ${discountScopeText(opts.promoType)}` : '';
  const requiredSuffix = requiredInlineText(opts.requiredConditions ?? []);
  return `Si compra ${umbral} de ${qc}, recibe ${premios}${alcance}${requiredSuffix ? `, ${requiredSuffix}` : ''}.`;
}

/** Una fila: su propio texto. Varias: "Surtido de N productos" (frases cortas, p. ej. el resumen del asistente). */
export function conditionsSummaryText(
  conditions: {
    scope?: ScopeCode;
    productCode?: string | null;
    productName?: string | null;
    familyName?: string | null;
    brandName?: string | null;
  }[],
): string {
  if (conditions.length === 0) return 'Cualquier compra que llegue al total mínimo del tramo';
  if (conditions.length === 1) return conditionText(conditions[0]);
  return `Surtido de ${conditions.length} productos`;
}
