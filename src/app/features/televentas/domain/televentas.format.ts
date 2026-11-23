// Formato propio del modo televentas — doc 42. ratingText/initials
// (features/customers/customer-format) y scheduleText (features/assignments/
// map-format) se reutilizan tal cual: mismo criterio ya tolerado para
// utilidades transversales (ARCHITECTURE_PANEL, sección 4).

export interface VisitStatusInfo {
  /** Texto de esta pantalla (doc 42, sección 6.4): "Compró", no "Atendido". */
  label: string;
  /** Para `<ui-status [status]>` — "Pendiente" a secas choca con Promoción. */
  badgeSlug: string;
  /** Token CSS para pintar el punto del mapa (resolver con resolveCssVar). */
  colorVar: string;
}

const STATUS_INFO: Record<string, VisitStatusInfo> = {
  PENDING: { label: 'Pendiente', badgeSlug: 'pending-visit', colorVar: '--st-pending-visit' },
  ATTENDED: { label: 'Compró', badgeSlug: 'attended', colorVar: '--st-attended' },
  NO_PURCHASE: { label: 'No compró', badgeSlug: 'no-purchase', colorVar: '--st-no-purchase' },
  CLOSED: { label: 'Cerrado', badgeSlug: 'closed', colorVar: '--st-closed' },
};

/** `null`/`undefined` (sin visita hoy) se trata igual que `PENDING`. */
export function visitStatusInfo(code: string | null | undefined): VisitStatusInfo {
  return STATUS_INFO[code ?? 'PENDING'] ?? STATUS_INFO['PENDING'];
}

/** visit_status_id del catálogo (sección 3.3) — para registrar la llamada. */
export const NO_PURCHASE_VISIT_STATUS_ID = 3;
