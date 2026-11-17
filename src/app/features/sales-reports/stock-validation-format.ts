// Validación de stock — doc 56, secciones 4.1 y 10. Etiquetas, tonos y
// textos de ayuda; todo lo demás (contadores, estado) llega listo del
// servidor.
import { format, parseISO } from 'date-fns';
import {
  NegativeStockRow,
  StockValidationAlerts,
  StockValidationRow,
  StockValidationStatus,
} from '../../shared/models/sales-report.models';
import { BadgeTone, BADGE_TONE_VAR } from '../inventory/inventory-format';

export { BADGE_TONE_VAR };
export type { BadgeTone };

const STATUS_TONE: Record<StockValidationStatus, BadgeTone> = {
  SHORTFALL: 'red',
  NO_ERP_STOCK: 'gray',
  OK: 'green',
};

export function statusLabel(row: StockValidationRow): string {
  switch (row.status) {
    case 'SHORTFALL':
      return `Faltan ${row.shortfallQuantity}`;
    case 'NO_ERP_STOCK':
      return 'Sin stock del ERP';
    default:
      return 'Alcanza';
  }
}

export function statusTone(row: StockValidationRow): BadgeTone {
  return STATUS_TONE[row.status];
}

export const TIP = {
  toBillQuantity:
    'Lo que los pedidos ya descontaron y el ERP todavía no factura. Incluye pedidos de días anteriores.',
  pendingQuantity: 'Bonificaciones que quedaron sin stock. El ERP también las va a facturar.',
  erpStock: 'Lo que informó el ERP en su última actualización.',
  availableQuantity:
    'Lo que queda en el ERP después de facturar todo. Si es negativo, faltan unidades.',
  shortfallCard:
    'Productos donde los pedidos suman más de lo que tiene el ERP. Esos pedidos no se pueden enviar a facturar.',
  advanceNotBackedCard: 'Hay un adelanto, pero el ERP no registró esa mercadería.',
  staleCard:
    'El producto no vino en la última actualización del ERP. Vuelva a actualizar desde el ERP.',
  appExcessCard:
    'La app tiene unidades que el ERP no tiene. Se corrigen solas en la próxima actualización del ERP.',
  pendingClock: 'Pendiente de stock',
};

export function panelHeadlineText(row: StockValidationRow): string {
  switch (row.status) {
    case 'SHORTFALL':
      return `Faltan ${row.shortfallQuantity} — reduzca uno o más pedidos hasta que alcance.`;
    case 'NO_ERP_STOCK':
      return 'El ERP no ha subido este producto: no se puede validar.';
    default:
      return 'Alcanza el stock del ERP para todos estos pedidos.';
  }
}

export function advanceNotBackedText(row: StockValidationRow): string {
  return `Hay un adelanto de ${row.openAdvanceQuantity} que el ERP no registró. Si la mercadería llegó, regístrela en el ERP y vuelva a actualizar.`;
}

// ─────────────────────── Reporte de negativos — doc 63 ───────────────────────

/** "dd/MM HH:mm", con año solo si no es el año en curso. */
export function shortDateTimeText(iso: string): string {
  const d = parseISO(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, sameYear ? 'dd/MM HH:mm' : 'dd/MM/yyyy HH:mm');
}

/**
 * "Subida ERP" en pantalla — doc 63, sección 3: sin año si es del año en
 * curso. `null` → cadena vacía; el llamador pinta la insignia "Sin subida".
 */
export function erpUploadScreenText(iso: string | null): string {
  return iso ? shortDateTimeText(iso) : '';
}

/**
 * "Subida ERP" en el archivo (Excel/PDF) — doc 63, sección 7.1: siempre con
 * año; termina en " *" si `erpStale`; "Sin subida" si nunca subió.
 */
export function erpUploadFileText(row: NegativeStockRow): string {
  if (!row.erpStockAt) return 'Sin subida';
  const text = format(parseISO(row.erpStockAt), 'dd/MM/yyyy HH:mm');
  return row.erpStale ? `${text} *` : text;
}

// ─────────────────────── Franja de avisos — doc 87, sección 4 ───────────────────────

export type AlertSeverity = 'danger' | 'warning' | 'info';
export type AlertKey =
  | 'ordersWithoutErpResponse'
  | 'sentNotBilledOrders'
  | 'openPreviousDaysOrders'
  | 'negativeStockProducts'
  | 'ordersMarkedAfterLastUpload';

export interface StockValidationAlertItem {
  key: AlertKey;
  severity: AlertSeverity;
  icon: string; // material-icons
  text: string;
  tip: string;
  actionLabel: string | null; // null = sin acción
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { danger: 0, warning: 1, info: 2 };

export const ALERT_SEVERITY_TONE_VAR: Record<AlertSeverity, string> = {
  danger: '--st-mismatch',
  warning: '--st-in-route',
  info: '--st-open',
};

/** "dd/MM" sin hora ni año — doc 87, sección 4.2 ("desde el 03/11"). */
function shortDateText(iso: string): string {
  return format(parseISO(iso), 'dd/MM');
}

const n = (count: number, singular: string, plural: string) => (count === 1 ? singular : plural);

/**
 * Arma la franja de avisos — doc 87, sección 4.2: solo los avisos > 0,
 * ordenados crítico → atención → informativo. `alerts` `null` (backend
 * viejo) → sin franja.
 */
export function alertItems(alerts: StockValidationAlerts | null): StockValidationAlertItem[] {
  if (!alerts) return [];
  const items: StockValidationAlertItem[] = [];

  if (alerts.ordersWithoutErpResponse > 0) {
    const count = alerts.ordersWithoutErpResponse;
    items.push({
      key: 'ordersWithoutErpResponse',
      severity: 'warning',
      icon: 'schedule',
      text: `${count} ${n(count, 'pedido', 'pedidos')} sin respuesta del ERP${
        alerts.oldestWithoutErpResponse
          ? ` (desde el ${shortDateText(alerts.oldestWithoutErpResponse)})`
          : ''
      }. Ya no ocupan stock: revise si se facturaron o anúlelos.`,
      tip: `Pedidos enviados que el ERP no facturó dentro de ${alerts.windowDays} días de su última subida. Se asumen anulados en el ERP y ya no ocupan stock en la app.`,
      actionLabel: 'Ver',
    });
  }

  if (alerts.sentNotBilledOrders > 0) {
    const count = alerts.sentNotBilledOrders;
    items.push({
      key: 'sentNotBilledOrders',
      severity: 'info',
      icon: 'hourglass_empty',
      text: `${count} ${n(count, 'pedido', 'pedidos')} enviados antes de hoy siguen sin facturar en el ERP.`,
      tip: 'Pedidos enviados antes de hoy que el ERP todavía no marcó como facturados. Siguen ocupando stock hasta que el ERP los facture.',
      actionLabel: null,
    });
  }

  if (alerts.openPreviousDaysOrders > 0) {
    const count = alerts.openPreviousDaysOrders;
    items.push({
      key: 'openPreviousDaysOrders',
      severity: 'warning',
      icon: 'history',
      text: `${count} ${n(count, 'pedido', 'pedidos')} abiertos de días anteriores: envíelos o anúlelos. Siguen ocupando stock.`,
      tip: 'Pedidos que nunca se enviaron a facturar. Ocupan stock mientras sigan abiertos.',
      actionLabel: 'Ver pedidos',
    });
  }

  if (alerts.negativeStockProducts > 0) {
    const count = alerts.negativeStockProducts;
    items.push({
      key: 'negativeStockProducts',
      severity: 'danger',
      icon: 'block',
      text: `${count} ${n(count, 'producto', 'productos')} con stock negativo en la app. Se corrigen en la próxima subida del ERP o en el re-cuadre nocturno.`,
      tip: 'La app tiene menos de 0 unidades. No debería pasar: se corrige solo en la próxima subida del ERP o en el re-cuadre nocturno.',
      actionLabel: 'Ver',
    });
  }

  if (alerts.ordersMarkedAfterLastUpload > 0) {
    items.push({
      key: 'ordersMarkedAfterLastUpload',
      severity: 'info',
      icon: 'sync',
      text: `El ERP marcó ${alerts.ordersMarkedAfterLastUpload} pedidos después de su última subida: el stock se corrige en el re-cuadre nocturno.`,
      tip: 'El ERP marcó pedidos como facturados después de subir su stock. Hasta la próxima subida o el re-cuadre, la app los descuenta dos veces.',
      actionLabel: null,
    });
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
