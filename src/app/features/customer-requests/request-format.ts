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
