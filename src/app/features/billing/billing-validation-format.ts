// Doc 32, sección 3.3 — motivos que se resuelven en otra pantalla (con un
// enlace directo a ella). Doc 55, sección 0.3: qué pedido es "recalculable"
// lo decide el servidor (`OrderBillingValidation.recalculable`); el panel
// ya no lo adivina a partir de los códigos de motivo.

import { BillingAction } from '../../shared/models/billing-validation.models';

/** Orden fijo de los chips de grupo — doc 65, sección 1.7. Es también el orden de prioridad (sección 1.5). */
export const BILLING_ACTION_ORDER: BillingAction[] = [
  'DEFINE_PRICE',
  'RECALCULATE',
  'EDIT_QUANTITY',
  'BONUS_TRAY',
  'CHOOSE_PRIZE',
  'MANUAL',
];

const BILLING_ACTION_LABELS: Record<BillingAction, string> = {
  DEFINE_PRICE: 'Definir precio',
  RECALCULATE: 'Recalcular',
  EDIT_QUANTITY: 'Editar cantidades',
  BONUS_TRAY: 'Bonificación sin stock',
  CHOOSE_PRIZE: 'Premio por elegir',
  MANUAL: 'Corregir a mano',
};

/** Variable CSS de tono — doc 65, sección 1.5. */
const BILLING_ACTION_TONES: Record<BillingAction, string> = {
  DEFINE_PRICE: '--status-danger',
  RECALCULATE: '--status-warn',
  EDIT_QUANTITY: '--status-danger',
  BONUS_TRAY: '--status-warn',
  CHOOSE_PRIZE: '--accent',
  MANUAL: '--ink-muted',
};

export function billingActionLabel(action: BillingAction): string {
  return BILLING_ACTION_LABELS[action];
}

export function billingActionTone(action: BillingAction): string {
  return BILLING_ACTION_TONES[action];
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

/** `reasonCode` de `OrderRecalculationOutcome` — doc 55, sección 4.2. */
export type RecalcOutcomeTone = 'success' | 'neutral' | 'danger';

export function recalcOutcomeText(outcome: {
  recalculated: boolean;
  reasonCode: string | null;
  reason: string | null;
}): string {
  if (outcome.recalculated) return 'Recalculado';
  switch (outcome.reasonCode) {
    case 'ALREADY_VALID':
      return 'Ya estaba correcto';
    case 'NOT_OPEN':
      return 'Ya no está abierto';
    case 'ERROR':
      return 'No se pudo recalcular; intente de nuevo';
    default:
      return outcome.reason || 'No se pudo recalcular; intente de nuevo';
  }
}

export function recalcOutcomeTone(outcome: {
  recalculated: boolean;
  reasonCode: string | null;
}): RecalcOutcomeTone {
  if (outcome.recalculated) return 'success';
  if (outcome.reasonCode === 'ALREADY_VALID' || outcome.reasonCode === 'NOT_OPEN') return 'neutral';
  return 'danger';
}
