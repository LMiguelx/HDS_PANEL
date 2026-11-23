import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClosureStatusCode, ClosureView } from '../../../shared/models/order-intake.models';

/** "jue 06/11 18:00" — doc 65, sección 2.9 (historial). */
export function shortDateTimeText(value: string): string {
  return format(parseISO(value), 'EEE dd/MM HH:mm', { locale: es });
}

/**
 * Clave de `ui-status` para pintar el estado del cierre con el color
 * correcto — reutiliza una entrada ya existente en su diccionario (mismo
 * patrón que otros dominios del panel: el valor del color importa, no el
 * texto de la clave). "Reabierto antes de tiempo" usa el mismo color que
 * "Activo" (--status-warn): algo a vigilar, no un simple dato histórico.
 */
const STATUS_KEYS: Record<ClosureStatusCode, string> = {
  SCHEDULED: 'programada', // azul informativo (--st-programada)
  ACTIVE: 'en ruta', // ámbar (--st-in-route = --status-warn)
  FINISHED: 'cerrado', // gris neutro (--st-closed)
  REOPENED: 'en ruta', // ámbar (--status-warn): reabierto antes de tiempo
  CANCELLED: 'rechazado', // rojo (--st-rejected = --status-danger)
};

export function closureStatusKey(code: ClosureStatusCode): string {
  return STATUS_KEYS[code];
}

/** Columna "Último cambio" del historial — doc 65, sección 2.9. */
export function lastChangeText(c: ClosureView): string {
  if (c.endedAt) {
    const verb = c.statusCode === 'CANCELLED' ? 'Anulado' : 'Reabierto';
    return `${verb} por ${c.endedByName} el ${shortDateTimeText(c.endedAt)}`;
  }
  if (c.updatedAt) {
    return `Extendido por ${c.updatedByName} el ${shortDateTimeText(c.updatedAt)}`;
  }
  return '—';
}
