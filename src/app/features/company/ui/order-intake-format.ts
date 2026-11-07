import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClosureStatusCode, ClosureView } from '../../../shared/models/order-intake.models';

/** "jue 06/11 18:00" — doc 65, sección 2.9 (historial). */
export function shortDateTimeText(value: string): string {
  return format(parseISO(value), 'EEE dd/MM HH:mm', { locale: es });
}

/** Tono del badge de estado — doc 65, sección 2.3. */
const STATUS_TONES: Record<ClosureStatusCode, string> = {
  SCHEDULED: '--accent',
  ACTIVE: '--status-warn',
  FINISHED: '--ink-muted',
  REOPENED: '--ink-muted',
  CANCELLED: '--ink-muted',
};

export function closureStatusTone(code: ClosureStatusCode): string {
  return STATUS_TONES[code];
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
