// Formato y niveles de aviso del Inicio de logística — doc 93, secciones
// 2.5 y 6. Umbrales como constantes, nunca escritos en el template.
import { ErpStockAlertView, ReceiptAlertView } from './logistics.models';

export type AlertLevel = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

/** "Entregas por revisar"/"sin tomar por el ERP": más antigua > 24 h. */
export const RECEIPT_STALE_HOURS = 24;
/** "Stock del ERP": sin subir en más de 24 h. */
export const ERP_STOCK_STALE_HOURS = 24;

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

/** "hace 5 min", "hace 3 h", "hace 2 días" — doc 93, sección 2.5. */
export function relativeTimeText(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} día${days === 1 ? '' : 's'}`;
}

/** "01/12 14:30"; con año si no es el actual. */
export function shortDateTimeText(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayMonth = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return sameYear ? `${dayMonth} ${time}` : `${dayMonth}/${d.getFullYear()} ${time}`;
}

/** Tarjeta 1 — Planillas que no pueden salir: 0 = verde, >0 = ámbar. */
export function batchesNotReadyLevel(count: number | null): AlertLevel | null {
  if (count == null) return null;
  return count > 0 ? 'warn' : 'ok';
}

/** Tarjeta 2 — Productos en negativo: 0 = verde, >0 = rojo. */
export function negativeProductsLevel(count: number | null): AlertLevel | null {
  if (count == null) return null;
  return count > 0 ? 'danger' : 'ok';
}

/** Tarjeta 3 — Entregas por revisar: 0 = verde, >0 = ámbar, más antigua > 24 h = rojo. */
export function receiptsInReviewLevel(a: ReceiptAlertView | null): AlertLevel | null {
  if (!a) return null;
  if (a.count === 0) return 'ok';
  const hrs = hoursSince(a.oldestAt);
  return hrs != null && hrs > RECEIPT_STALE_HOURS ? 'danger' : 'warn';
}

/** Tarjeta 4 — Entregas sin tomar por el ERP: 0 = verde, >0 = azul, más antigua > 24 h = ámbar. */
export function receiptsNotTakenLevel(a: ReceiptAlertView | null): AlertLevel | null {
  if (!a) return null;
  if (a.count === 0) return 'ok';
  const hrs = hoursSince(a.oldestAt);
  return hrs != null && hrs > RECEIPT_STALE_HOURS ? 'warn' : 'info';
}

/** Tarjeta 5 — Stock del ERP: al día = verde; >24h sin subir o cuadre fallido = rojo; por procesar = ámbar; nunca subió = gris. */
export function erpStockLevel(a: ErpStockAlertView | null): AlertLevel | null {
  if (!a) return null;
  if (a.lastUploadAt == null) return 'muted';
  if (a.failedProducts > 0) return 'danger';
  const hrs = a.minutesSinceLastUpload != null ? a.minutesSinceLastUpload / 60 : null;
  if (hrs != null && hrs > ERP_STOCK_STALE_HOURS) return 'danger';
  if (a.pendingUploads > 0) return 'warn';
  return 'ok';
}

/** "hace 3 h" o "Sin subidas" — número grande de la tarjeta 5. */
export function erpStockTimeText(a: ErpStockAlertView | null): string {
  if (!a || a.lastUploadAt == null) return 'Sin subidas';
  return relativeTimeText(a.lastUploadAt);
}

/** "{failedProducts} con cuadre fallido" o "{pendingUploads} por procesar" — detalle de la tarjeta 5. */
export function erpStockDetailText(a: ErpStockAlertView | null): string {
  if (!a) return '';
  if (a.failedProducts > 0) return `${a.failedProducts} con cuadre fallido`;
  if (a.pendingUploads > 0) return `${a.pendingUploads} por procesar`;
  return 'Al día';
}
