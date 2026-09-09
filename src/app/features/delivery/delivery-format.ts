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

function nameFor(options: StatusOption[], code: string | null | undefined): string {
  return options.find((o) => o.code === code)?.name ?? code ?? '—';
}

export function batchStatusName(code: string | null | undefined): string {
  return nameFor(BATCH_STATUS_OPTIONS, code);
}

export function itemStatusName(code: string | null | undefined): string {
  return nameFor(ITEM_STATUS_OPTIONS, code);
}
