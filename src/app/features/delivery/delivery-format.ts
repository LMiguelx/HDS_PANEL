export interface StatusOption {
  code: string;
  name: string;
}

/** delivery_batch_status */
export const BATCH_STATUS_OPTIONS: StatusOption[] = [
  { code: 'OPEN', name: 'Abierta' },
  { code: 'IN_ROUTE', name: 'En ruta' },
  { code: 'SETTLED', name: 'Liquidada' },
];

/** Mismos tokens que ya pinta ui-status para estos códigos — se reutilizan
 * tal cual donde hace falta el valor de color (gráficos, mapa), para que
 * todo el panel asocie el mismo color a cada estado. */
export const BATCH_STATUS_COLOR_VAR: Record<string, string> = {
  OPEN: '--st-open',
  IN_ROUTE: '--st-in-route',
  SETTLED: '--st-settled',
};

/** delivery_item_status. El ítem nunca vuelve a PENDING una vez que sale de
 * ese estado; cualquier otra transición (incluso DELIVERED → REJECTED) es
 * válida las veces que sea — regla del backend, no editable desde este panel. */
export const ITEM_STATUS_OPTIONS: StatusOption[] = [
  { code: 'PENDING', name: 'Pendiente' },
  { code: 'DELIVERED', name: 'Entregado' },
  { code: 'PARTIAL', name: 'Entrega parcial' },
  { code: 'REJECTED', name: 'Rechazado por el cliente' },
];

/** role_in_team — pestaña Equipo (doc 31, sección 3.3). `null` = ya no está en el equipo. */
export const ROLE_IN_TEAM_OPTIONS: StatusOption[] = [
  { code: 'DRIVER', name: 'Conductor' },
  { code: 'HELPER', name: 'Ayudante' },
];

function nameFor(options: StatusOption[], code: string | null | undefined): string {
  return options.find((o) => o.code === code)?.name ?? code ?? '—';
}

export function batchStatusName(code: string | null | undefined): string {
  return nameFor(BATCH_STATUS_OPTIONS, code);
}

export function itemStatusName(code: string | null | undefined): string {
  return nameFor(ITEM_STATUS_OPTIONS, code);
}

export function roleInTeamName(code: string | null | undefined): string {
  return code ? nameFor(ROLE_IN_TEAM_OPTIONS, code) : 'Ya no está en el equipo';
}

// — Descuento perdido / A cobrar (doc 53, secciones 2 y 14) —

export const CHARGE_AMOUNT_TOOLTIP =
  'Descuento que el cliente pierde porque, después de devolver, ya no cumple la promoción (o baja de tramo). Se le cobra de más.';
export const AMOUNT_TO_COLLECT_TOOLTIP =
  'Lo que realmente hay que cobrar: el neto del comprobante más el descuento perdido.';
export const NET_AMOUNT_TOOLTIP = 'Monto del comprobante menos lo devuelto, como figura en el ERP.';
export const DISCOUNT_CHARGE_TOOLTIP =
  'Del pedido: descuento facturado. Quedaba: el que sigue en el comprobante después de devolver. Ahora: el que le corresponde con lo que se queda. A cobrar: la diferencia.';

/** `benefitType` — doc 53, sección 4.3 (Promociones del comprobante). */
export function benefitTypeName(code: string | null | undefined): string {
  if (code === 'FREE_PRODUCT') return 'Bonificación';
  if (code === 'DISCOUNT_PERCENT') return 'Descuento %';
  if (code === 'DISCOUNT_AMOUNT') return 'Descuento S/';
  return code ?? '—';
}

/** `measureType` — doc 53, sección 4.4. */
export function measureTypeName(code: string | null | undefined): string {
  return code === 'AMOUNT' ? 'Soles' : 'Unidades';
}
