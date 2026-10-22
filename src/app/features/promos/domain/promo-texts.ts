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

/** "Se entrega siempre" · "El cliente elige {chooseCount} de {n}" — sección 3.6. */
export function groupModeText(
  selectionMode: SelectionModeCode,
  chooseCount: number | null | undefined,
  optionsCount: number,
): string {
  if (selectionMode === 'CHOOSE') return `El cliente elige ${chooseCount ?? 1} de ${optionsCount}`;
  return 'Se entrega siempre';
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

/** Columna "Cantidad" de la tabla de tramos: unidades, soles o porcentaje según el tipo — sección 6.2. */
export function benefitQuantityText(b: {
  benefitType?: BenefitTypeCode;
  quantity?: number | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
}): string {
  if (b.benefitType === 'DISCOUNT_AMOUNT') return formatSoles(b.discountAmount ?? 0);
  if (b.benefitType === 'DISCOUNT_PERCENT') return `${b.discountPercent ?? 0}%`;
  return quantityText(b.quantity ?? 0);
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
