import { UiFieldOption } from '../../shared/ui/field/field';

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
