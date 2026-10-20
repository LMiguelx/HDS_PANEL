// Contratos del panel de administración de asignaciones (/api/admin/assignments).
// Escritos a mano porque el endpoint es nuevo y `api.ts` (generado por
// openapi-typescript) todavía no lo incluye — mismo criterio ya usado en
// sales-report.models.ts / segment.models.ts. Ver
// 29-panel-admin-asignaciones-mapa-coberturas.md.

export interface AssignmentView {
  assignmentId: number;
  customerId: number;
  userId: number;
  assignmentType: string; // 'SALES'
  frequencyType: string; // 'WEEKLY'
  effectiveFrom: string; // yyyy-MM-dd
  effectiveTo: string | null; // null = vigente
  weekdays: number[]; // ISO 1..7, puede venir incompleto (ver hasGap)
  weeksOfCycle: number[]; // 1..4, puede venir incompleto (ver hasGap)
}

/** Fila del listado (GET /) — mismos campos de AssignmentView + nombres. */
export interface AssignmentAdminView extends AssignmentView {
  customerCode: string;
  customerName: string;
  userName: string; // vendedor
}

export interface AssignmentListFilters {
  userId?: number;
  customerId?: number;
  hasGap?: boolean;
  page?: number;
  size?: number;
  sort?: string;
}

export interface OrphanCustomerView {
  customerId: number;
  code: string;
  customerName: string;
  address: string | null;
  phone: string | null;
  latitude: number | null; // null = GPS sin capturar
  longitude: number | null;
  createdAt: string; // ISO datetime — desde cuándo está sin vendedor
}

export interface VendorOnRouteView {
  userId: number;
  userName: string;
  /** null en vendors-without-route-today (nunca hay ruta que mostrar). */
  startTime: string | null; // ISO datetime
  startLatitude: number | null; // null = GPS sin capturar al iniciar ruta
  startLongitude: number | null;
}

/**
 * Nace siempre hoy: no se envía effectiveFrom (doc 33, sección 6.4).
 * weekdays/weeksOfCycle son obligatorios desde doc 33 — al menos un valor
 * cada uno; una asignación manual ya no puede nacer con horario incompleto.
 */
export interface CreateAssignmentCommand {
  customerId: number;
  userId: number;
  weekdays: number[];
  weeksOfCycle: number[];
}

export interface UpdateScheduleCommand {
  // PATCH parcial: solo se reemplaza lo enviado. `undefined` = no tocar.
  // Doc 33, sección 7.3: ya no se admite una lista vacía — si se envía,
  // debe traer al menos un valor.
  weekdays?: number[];
  weeksOfCycle?: number[];
}

export type CoverageSelection = 'SCHEDULED' | 'ALL_PORTFOLIO' | 'CUSTOMER_IDS';

export interface CreateCoverageCommand {
  absentUserId: number;
  coveringUserId: number;
  coverageDate: string; // yyyy-MM-dd, hoy o futura
  selection: CoverageSelection;
  customerIds: number[]; // solo con CUSTOMER_IDS (al menos uno); vacío en las otras
  reason?: string; // máx 255
}

export interface CoverageView {
  coverageId: number;
  customerId: number;
  absentUserId: number;
  coveringUserId: number;
  coverageDate: string;
  reason: string | null;
}

/** Fila del listado de coberturas ya realizadas (GET /coverage). */
export interface CoverageAdminView {
  coverageId: number;
  customerId: number;
  customerName: string;
  absentUserId: number;
  absentUserName: string;
  coveringUserId: number;
  coveringUserName: string;
  coverageDate: string; // yyyy-MM-dd
  reason: string | null;
  createdAt: string; // ISO datetime
}

export interface CoverageListFilters {
  absentUserId?: number;
  coveringUserId?: number;
  page?: number;
  size?: number;
}

/**
 * Cartera real del vendedor ausente en la fecha dada — GET /coverage-candidates.
 * Llegan con los programados primero y luego por nombre.
 */
export interface CoverageCandidateView {
  customerId: number;
  code: string;
  businessName: string;
  rating: number | null; // 1 a 5; null = sin calificar
  scheduledOnDate: boolean; // el ausente lo tenía programado esa fecha
  existingCoveringUserId: number | null;
  existingCoveringUserName: string | null;
}

export interface ImportCoverageParams {
  absentUserId: number;
  coveringUserId: number;
  coverageDate: string; // yyyy-MM-dd, hoy o futura
  reason?: string;
}

export interface ImportCoverageResult {
  totalRows: number;
  invalidRows: number;
  duplicatesInFile: number;
  matched: number;
  notInPortfolio: number;
  inactive: number;
  notFound: number;
  alreadyCovered: number;
  toReassign: number;
  toCreate: number;
  applied: boolean;
  notFoundSample: string[];
  notInPortfolioSample: string[];
  invalidSample: string[];
}

/**
 * Shape no detallado por el backend a la fecha de este documento (ver
 * 12-endpoints-admin-panel-asignaciones.md, sección `/auto-assign`). Se
 * define de forma defensiva (todo opcional) para no romper la UI si el DTO
 * real trae más o menos campos — ajustar cuando se confirme el controller.
 */
export interface AutoAssignmentResult {
  assignedCount?: number;
  skippedCount?: number;
  details?: unknown;
}

export interface IncompleteScheduleView {
  assignmentId: number;
  customerId: number;
  customerCode: string;
  customerName: string;
  userId: number;
  userName: string;
  hasWeekdays: boolean;
  hasWeeksOfCycle: boolean;
}

export interface PendingScheduleFilters {
  page?: number;
  size?: number;
}
