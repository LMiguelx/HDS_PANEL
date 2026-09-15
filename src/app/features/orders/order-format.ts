export interface StatusOption {
  code: string;
  name: string;
}

/** order_status */
export const ORDER_STATUS_OPTIONS: StatusOption[] = [
  { code: 'OPEN', name: 'Abierto' },
  { code: 'SENT_TO_BILLING', name: 'Enviado a facturación' },
  { code: 'CANCELLED', name: 'Anulado' },
];

/** delivery_status — mismo catálogo que ya usa el módulo de Reparto para
 * delivery_item_status (mismos tokens de color, misma etiqueta). */
export const DELIVERY_STATUS_OPTIONS: StatusOption[] = [
  { code: 'IN_ROUTE', name: 'En ruta' },
  { code: 'DELIVERED', name: 'Entregado' },
  { code: 'PARTIAL', name: 'Entrega parcial' },
  { code: 'REJECTED', name: 'Rechazado' },
];

/** Reutiliza los mismos tokens --st-* ya definidos para planilla/ítem de
 * reparto, para que todo el panel asocie el mismo color a cada estado. */
export const ORDER_STATUS_COLOR_VAR: Record<string, string> = {
  OPEN: '--st-open',
  SENT_TO_BILLING: '--st-sent-to-billing',
  CANCELLED: '--st-cancelled',
};

export const DELIVERY_STATUS_COLOR_VAR: Record<string, string> = {
  IN_ROUTE: '--st-in-route',
  DELIVERED: '--st-delivered',
  PARTIAL: '--st-partial',
  REJECTED: '--st-rejected',
};

function nameFor(options: StatusOption[], code: string | null | undefined): string {
  return options.find((o) => o.code === code)?.name ?? code ?? '—';
}

export function orderStatusName(code: string | null | undefined): string {
  return nameFor(ORDER_STATUS_OPTIONS, code);
}

export function deliveryStatusName(code: string | null | undefined): string {
  return code ? nameFor(DELIVERY_STATUS_OPTIONS, code) : 'Sin reparto';
}
