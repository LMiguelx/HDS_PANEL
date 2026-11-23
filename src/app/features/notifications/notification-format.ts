import { UiFieldOption } from '../../shared/ui/field/field';

/** Sección 3.4 — un código fuera de esta tabla se muestra como "Notificación". */
export const NOTIFICATION_TYPE_NAME: Record<string, string> = {
  MANUAL: 'Mensaje de supervisión',
  DELIVERY_RETURN_PARTIAL: 'Devolución parcial',
  DELIVERY_RETURN_REJECTED: 'Pedido rechazado',
  DELIVERY_ITEM_RESOLVED: 'Entrega confirmada',
  BATCH_IN_ROUTE: 'Pedidos en ruta',
  PROMO_AVAILABLE: 'Promoción disponible',
  RETURN: 'Devolución',
};

export function notificationTypeName(code: string): string {
  return NOTIFICATION_TYPE_NAME[code] ?? 'Notificación';
}

export const NOTIFICATION_TYPE_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los tipos' },
  ...Object.entries(NOTIFICATION_TYPE_NAME).map(([value, label]) => ({ value, label })),
];

/**
 * Roles que no tienen bandeja propia (Administrador, Supervisor): un envío
 * manual a ellos quedaría sin leer, así que el formulario de Nuevo envío no
 * los ofrece — sección 9.2. El filtro del listado sí los muestra.
 */
export const BROADCAST_EXCLUDED_ROLE_CODES = new Set(['ADMIN', 'SUPERVISOR']);
