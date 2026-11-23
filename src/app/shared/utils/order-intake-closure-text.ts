import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClosureView } from '../models/order-intake.models';

/**
 * "vie 07/11 a las 06:00" — banda de bloqueo de televentas, doc 65, sección
 * 2.7 ("hasta el {día} {fecha} a las {hora}").
 */
export function closedUntilText(closure: ClosureView): string {
  return format(parseISO(closure.endsAt), "EEE dd/MM 'a las' HH:mm", { locale: es });
}
