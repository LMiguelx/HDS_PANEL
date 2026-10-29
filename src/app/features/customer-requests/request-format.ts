export { ubigeoText, mapsUrl } from '../../shared/utils/ubigeo';

export interface CatalogOption {
  id: number;
  name: string;
}

/** document_type — catálogo fijo, usado en CreationRequestDetail.documentTypeId. */
export const DOCUMENT_TYPE_OPTIONS: CatalogOption[] = [
  { id: 1, name: 'Doc. Nacional de Identidad' },
  { id: 2, name: 'Carné de extranjería' },
  { id: 3, name: 'Reg. único de contribuyentes' },
];

/** customer_type — catálogo fijo, usado en CreationRequestDetail.customerTypeId. */
export const CUSTOMER_TYPE_OPTIONS: CatalogOption[] = [
  { id: 1, name: 'Mayorista' },
  { id: 2, name: 'Minorista' },
  { id: 3, name: 'Especial' },
  { id: 4, name: 'Zona de viaje' },
  { id: 5, name: 'Zona Pedregal' },
];

function nameFor(options: CatalogOption[], id: number | null | undefined): string {
  return options.find((o) => o.id === id)?.name ?? (id != null ? `#${id}` : '—');
}

export function documentTypeName(id: number | null | undefined): string {
  return nameFor(DOCUMENT_TYPE_OPTIONS, id);
}

export function customerTypeName(id: number | null | undefined): string {
  return nameFor(CUSTOMER_TYPE_OPTIONS, id);
}

/** Días de visita — doc 39, sección 3.4. */
export const WEEKDAYS: { value: number; label: string; fullLabel: string }[] = [
  { value: 1, label: 'Lun', fullLabel: 'lunes' },
  { value: 2, label: 'Mar', fullLabel: 'martes' },
  { value: 3, label: 'Mié', fullLabel: 'miércoles' },
  { value: 4, label: 'Jue', fullLabel: 'jueves' },
  { value: 5, label: 'Vie', fullLabel: 'viernes' },
  { value: 6, label: 'Sáb', fullLabel: 'sábado' },
  { value: 7, label: 'Dom', fullLabel: 'domingo' },
];

/** Semanas del ciclo — doc 39, sección 3.4. Nuevas, obligatorias al aprobar una creación. */
export const CYCLE_WEEKS: { value: number; label: string }[] = [
  { value: 1, label: 'Semana 1' },
  { value: 2, label: 'Semana 2' },
  { value: 3, label: 'Semana 3' },
  { value: 4, label: 'Semana 4' },
];

function joinWithY(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** "Visitará los lunes, miércoles y viernes de las semanas 1 y 3." — doc 39, sección 5.5. Vacío si falta elegir algo. */
export function visitSummaryText(weekdayValues: number[], weekValues: number[]): string {
  if (weekdayValues.length === 0 || weekValues.length === 0) return '';
  const days = joinWithY(
    weekdayValues.map((v) => WEEKDAYS.find((d) => d.value === v)?.fullLabel ?? String(v)),
  );
  const weeksList = joinWithY(weekValues.map((v) => String(v)));
  const weeksPhrase =
    weekValues.length === 1 ? `la semana ${weeksList}` : `las semanas ${weeksList}`;
  return `Visitará los ${days} de ${weeksPhrase}.`;
}

/** Campos editables de cambio de campo — doc 39, sección 3.3. */
const FIELD_LABELS: Record<string, string> = {
  BUSINESS_NAME: 'Razón social',
  ADDRESS: 'Dirección',
  PHONE: 'Teléfono',
  BUSINESS_ACTIVITY: 'Actividad',
  DOCUMENT_NUMBER: 'Número de documento',
  LATITUDE: 'Latitud',
  LONGITUDE: 'Longitud',
};

export function fieldNameLabel(code: string): string {
  return FIELD_LABELS[code] ?? code;
}

export type ErpTone = 'warn' | 'ok';

export interface ErpStatusInfo {
  label: string;
  tone: ErpTone;
}

/** Etiqueta del estado del ERP para creación y cierre — doc 39, sección 3.1. */
export function erpStatusLabel(erpRegistered: boolean): ErpStatusInfo {
  return erpRegistered
    ? { label: 'Lista para aprobar', tone: 'ok' }
    : { label: 'Esperando ERP', tone: 'warn' };
}

/** Ídem para un grupo de cambio de campo, con registro parcial ("ERP 1 de 3"). */
export function fieldChangeErpStatusLabel(registeredCount: number, total: number): ErpStatusInfo {
  if (registeredCount <= 0) return { label: 'Esperando ERP', tone: 'warn' };
  if (registeredCount >= total) return { label: 'Lista para aprobar', tone: 'ok' };
  return { label: `ERP ${registeredCount} de ${total}`, tone: 'warn' };
}
