import { format, isToday, parseISO } from 'date-fns';
import { UiFieldOption } from '../../shared/ui/field/field';
import { Role } from '../../shared/models/auth.models';

/** sales_channel — catálogo fijo. Ver 21-panel-admin-usuarios-roles-...md, sección 0.3. */
export const SALES_CHANNEL_OPTIONS: UiFieldOption[] = [
  { value: '0', label: 'Ninguno' },
  { value: '1', label: 'Minorista' },
  { value: '2', label: 'Mayorista' },
  { value: '3', label: 'Zona de Viaje' },
];

export function salesChannelName(id: number | null | undefined): string {
  return (
    SALES_CHANNEL_OPTIONS.find((o) => o.value === String(id))?.label ??
    (id != null ? `#${id}` : '—')
  );
}

/** Iniciales para el avatar de la ficha de usuario (máx. 2 letras). */
export function userInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export interface RolesDisplay {
  text: string;
  title: string; // tooltip con todos los roles; vacío si no hace falta
}

/** "Vendedor, Conductor" o, con más de dos, "Vendedor, Conductor +2" con title — doc 66, sección 5.2. */
export function rolesText(roles: Role[]): RolesDisplay {
  if (roles.length === 0) return { text: '—', title: '' };
  if (roles.length <= 2) return { text: roles.map((r) => r.name).join(', '), title: '' };
  const shown = roles
    .slice(0, 2)
    .map((r) => r.name)
    .join(', ');
  return { text: `${shown} +${roles.length - 2}`, title: roles.map((r) => r.name).join(', ') };
}

/** "Hoy 07:40" · "06/11 07:40" · "Nunca ingresó" — doc 66, sección 5.2. */
export function lastLoginText(iso: string | null): string {
  if (!iso) return 'Nunca ingresó';
  const d = parseISO(iso);
  return isToday(d) ? `Hoy ${format(d, 'HH:mm')}` : format(d, 'dd/MM HH:mm');
}

export interface JornadaDisplay {
  text: string;
  state: 'active' | 'finished' | 'none';
}

/** Columna "Jornada hoy" — doc 66, sección 5.2. */
export function jornadaTodayText(startedAt: string | null, endedAt: string | null): JornadaDisplay {
  if (!startedAt) return { text: '—', state: 'none' };
  if (!endedAt) {
    return { text: `En jornada · ${format(parseISO(startedAt), 'HH:mm')}`, state: 'active' };
  }
  return {
    text: `Finalizada ${format(parseISO(startedAt), 'HH:mm')}–${format(parseISO(endedAt), 'HH:mm')}`,
    state: 'finished',
  };
}
