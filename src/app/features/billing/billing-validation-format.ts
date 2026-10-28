// Doc 32, sección 3.3 — qué motivos se resuelven con "Recalcular pedido" y
// cuáles se resuelven en otra pantalla (con un enlace directo a ella).

const RECALC_CODES = new Set([
  'PRICE_MISMATCH',
  'BONUS_WITH_PRICE',
  'TOTAL_MISMATCH',
  'DISCOUNT_MISMATCH',
  'LINE_DISCOUNT_MISMATCH', // doc 47, sección 15 — "Descuento por producto"
  'BONUS_WITHOUT_ORIGIN',
  'BONUS_NOT_GRANTED',
  'BONUS_LINE_MISSING',
]);

export function hasRecalcFix(codes: string[]): boolean {
  return codes.some((c) => RECALC_CODES.has(c));
}

export interface ElsewhereLink {
  label: string;
  route: string[];
}

const ELSEWHERE_LINKS: Record<string, ElsewhereLink> = {
  SALESPERSON_INACTIVE: { label: 'Ir a Usuarios', route: ['/usuarios'] },
  PRICE_NOT_DEFINED: { label: 'Ir a Precios', route: ['/precios'] },
  BONUS_STOCK_PENDING: {
    label: 'Ir a Bonificaciones sin stock',
    route: ['/pedidos/bonificaciones-sin-stock'],
  },
  PROMO_CHOICE_PENDING: { label: 'Ir a Premios por elegir', route: ['/promociones/pendientes'] },
};

export function elsewhereLinkFor(code: string): ElsewhereLink | null {
  return ELSEWHERE_LINKS[code] ?? null;
}

/** Nombre a mostrar del motivo de "no enviado" — sección 3.4. `reasonCode` solo llega con sent = false. */
export function sendReasonName(reasonCode: string | null | undefined): string {
  const names: Record<string, string> = {
    VALIDATION_FAILED: 'No pasó la validación',
    ORDER_CHANGED: 'El pedido cambió',
    BLOCKED: 'No se pudo enviar',
    NOT_FOUND: 'No encontrado',
    ERROR: 'Error inesperado',
  };
  return (reasonCode && names[reasonCode]) || reasonCode || '—';
}
