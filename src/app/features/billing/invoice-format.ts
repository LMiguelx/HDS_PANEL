export interface StatusOption {
  code: string;
  name: string;
}

/** invoice_match_status */
export const MATCH_STATUS_OPTIONS: StatusOption[] = [
  { code: 'UNMATCHED', name: 'Sin conciliar' },
  { code: 'MATCHED_AUTO', name: 'Conciliado automáticamente' },
  { code: 'MATCHED_MANUAL', name: 'Conciliado manualmente' },
  { code: 'MISMATCH', name: 'Con diferencias' },
];

export function matchStatusName(code: string | null | undefined): string {
  return MATCH_STATUS_OPTIONS.find((o) => o.code === code)?.name ?? code ?? '—';
}
