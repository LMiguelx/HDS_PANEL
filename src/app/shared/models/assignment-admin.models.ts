// Contratos del panel de administración de asignaciones (/api/admin/assignments).
// Escritos a mano porque el endpoint es nuevo y `api.ts` (generado por
// openapi-typescript) todavía no lo incluye — mismo criterio ya usado en
// assignment.models.ts / customer.models.ts. Reemplazar por alias a `api.ts`
// cuando el backend regenere el esquema con este módulo incluido.

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

export interface AssignmentListFilters {
  userId?: number;
  customerId?: number;
  hasGap?: boolean;
  page?: number;
  size?: number;
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

export interface MapCustomerView {
  customerId: number;
  code: string;
  customerName: string;
  latitude: number;
  longitude: number;
  /** null si el cliente es huérfano. */
  userId: number | null;
  userName: string | null;
  /** null si no hay visita registrada hoy (aunque haya tenido una ayer). */
  visitStatusCode: string | null;
  /** true si según weekday + semana del ciclo, hoy le toca visita. */
  scheduledToday: boolean;
}

export interface MapQuery {
  userIds?: number[];
  orphansOnly?: boolean;
}

export interface CreateAssignmentCommand {
  customerId: number;
  userId: number;
  effectiveFrom: string; // yyyy-MM-dd
  weekdays?: number[]; // opcional al crear — vacío/omitido = horario incompleto
  weeksOfCycle?: number[];
}

export interface UpdateScheduleCommand {
  // PATCH parcial: solo se reemplaza lo enviado. `undefined` = no tocar;
  // una lista (incluso []) sí reemplaza el campo.
  weekdays?: number[];
  weeksOfCycle?: number[];
}

export interface CreateCoverageCommand {
  absentUserId: number;
  coveringUserId: number;
  coverageDate: string; // yyyy-MM-dd
  customerIds: number[];
  reason?: string; // máx 255
}

export interface CoverageView {
  coverageId: number;
  absentUserId: number;
  coveringUserId: number;
  coverageDate: string;
  customerId: number;
  reason: string | null;
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
  customerName: string;
  userId: number;
  hasWeekdays: boolean;
  hasWeeksOfCycle: boolean;
}
