export const STATUS_LABELS: Record<string, string> = {
  // Pedido
  OPEN: 'Abierto',
  SENT_TO_BILLING: 'Enviado a facturación',
  CANCELLED: 'Cancelado',
  // Planilla
  IN_ROUTE: 'En ruta',
  SETTLED: 'Liquidada',
  // Comprobante
  PENDING: 'Pendiente',
  DELIVERED: 'Entregado',
  PARTIAL: 'Parcial',
  REJECTED: 'Rechazado',
  // Conciliación
  UNMATCHED: 'Sin conciliar',
  MATCHED_AUTO: 'Conciliada (auto)',
  MATCHED_MANUAL: 'Conciliada (manual)',
  MISMATCH: 'Diferencia',
  // Visita
  ATTENDED: 'Atendido',
  CLOSED: 'Cerrado',
  NO_PURCHASE: 'No compró',
};

export function statusLabel(code: string | null | undefined): string {
  return code ? (STATUS_LABELS[code] ?? code) : '—';
}
