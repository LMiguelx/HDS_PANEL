import { PromoBenefit, PromoCondition } from '../models/promo.models';

export const PROMO_TYPE_LABELS: Record<string, string> = {
  PRODUCT_QTY: 'Por cantidad de producto',
  BRAND_FAMILY: 'Por marca/familia',
  TIERED: 'Escalonada',
  ORDER_TOTAL: 'Por total del pedido',
  COMBO: 'Combo',
  CUSTOMER_LIST: 'Lista de clientes',
};

export const BENEFIT_LABELS: Record<string, string> = {
  FREE_PRODUCT: 'Producto gratis',
  DISCOUNT_AMOUNT: 'Descuento (S/)',
  DISCOUNT_PERCENT: 'Descuento (%)',
};

export const SCOPE_LABELS: Record<string, string> = {
  PRODUCT: 'Producto',
  FAMILY: 'Familia',
  BRAND: 'Marca',
  ORDER: 'Pedido total',
  COMBO_ITEM: 'Ítem de combo',
};

export function promoTypeLabel(code: string): string {
  return PROMO_TYPE_LABELS[code] ?? code;
}

export function benefitText(b: PromoBenefit): string {
  switch (b.benefitType) {
    case 'FREE_PRODUCT':
      return `${b.productName ?? 'Producto #' + b.productId} × ${b.quantity ?? 1} gratis`;
    case 'DISCOUNT_AMOUNT':
      return `Descuento de S/ ${b.discountAmount}`;
    case 'DISCOUNT_PERCENT':
      return `Descuento de ${b.discountPercent}%`;
    default:
      return b.label ?? BENEFIT_LABELS[b.benefitType] ?? b.benefitType;
  }
}

export function conditionText(c: PromoCondition): string {
  const scope = SCOPE_LABELS[c.scope] ?? c.scope;
  const target = c.productName ?? c.familyName ?? c.brandName ?? '';
  const min =
    c.minQuantity != null
      ? `≥ ${c.minQuantity} und`
      : c.minAmount != null
        ? `≥ S/ ${c.minAmount}`
        : '';
  return [scope, target, min].filter(Boolean).join(' · ');
}
