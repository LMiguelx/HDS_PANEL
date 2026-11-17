import {
  PickingProductConsolidatedView,
  PickingStatusCounts,
} from '../../shared/models/picking.models';

export interface StatusOption {
  code: string;
  name: string;
}

/** `pickingStatus` — doc 89, sección 0. */
export const PICKING_STATUS_OPTIONS: StatusOption[] = [
  { code: 'PENDING', name: 'Pendiente' },
  { code: 'COMPLETE', name: 'Completo' },
  { code: 'SHORT', name: 'Faltante' },
  { code: 'NOT_LOADED', name: 'No cargado' },
];

export const PICKING_STATUS_COLOR_VAR: Record<string, string> = {
  PENDING: '--st-pending',
  COMPLETE: '--success',
  SHORT: '--status-warn',
  NOT_LOADED: '--status-danger',
};

export const PICKING_STATUS_ICON: Record<string, string> = {
  PENDING: '',
  COMPLETE: '✔',
  SHORT: '⚠',
  NOT_LOADED: '✖',
};

export function pickingStatusName(code: string | null | undefined): string {
  return PICKING_STATUS_OPTIONS.find((o) => o.code === code)?.name ?? code ?? '—';
}

/** "01/12 14:30" si es de este año; con año completo si no. */
export function shortDateTimeText(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayMonth = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return sameYear ? `${dayMonth} ${time}` : `${dayMonth}/${d.getFullYear()} ${time}`;
}

/** "18 / 25 revisados" — revisados = total − pendientes. */
export function reviewedText(counts: PickingStatusCounts): string {
  const total = counts.complete + counts.shortLoaded + counts.notLoaded + counts.pending;
  const reviewed = total - counts.pending;
  return `${reviewed} / ${total} revisados`;
}

/**
 * Vista previa del estado de una fila mientras el usuario escribe, sin
 * tocar lo que manda el backend (doc 89, sección 3.3 — "regla de oro").
 * Solo decide si cargado ≥ esperado, 0 < cargado < esperado o 0.
 */
export function previewStatus(loadedQuantity: number | null, totalQuantity: number): string {
  if (loadedQuantity == null) return 'PENDING';
  if (loadedQuantity <= 0) return 'NOT_LOADED';
  if (loadedQuantity >= totalQuantity) return 'COMPLETE';
  return 'SHORT';
}

/** "x3" bajo el nombre del producto si maneja paquetes. */
export function packSuffixText(p: PickingProductConsolidatedView): string {
  return p.unitsPerPackage != null ? `x${p.unitsPerPackage}` : '';
}
