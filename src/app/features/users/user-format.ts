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
