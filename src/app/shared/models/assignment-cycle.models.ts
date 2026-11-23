// Ciclo de asignaciones — doc 65, sección 3. TenantController,
// /api/tenant/assignment-cycle-anchor. `config.edit`.

export interface CycleInfoView {
  anchorDate: string; // fecha ancla, "yyyy-MM-dd"
  currentWeekOfCycle: number; // 1 a 4
  weekStartDate: string; // lunes de la semana en curso
  weekEndDate: string; // domingo de la semana en curso
  cycleStartDate: string; // lunes de la semana 1 del ciclo en curso
  cycleEndDate: string; // domingo de la semana 4 del ciclo en curso
}

export interface UpdateCycleAnchorCommand {
  date: string; // nueva fecha ancla, "yyyy-MM-dd"
  confirm: boolean; // false = solo vista previa; true = aplicar
}

export interface CycleAnchorImpactPreview {
  currentAnchor: string;
  proposedAnchor: string;
  currentWeekToday: number; // semana de hoy con el ancla actual
  proposedWeekToday: number; // semana de hoy con el ancla propuesta
  totalAssignmentsWithWeekFilter: number;
  appearingToday: number; // asignaciones que pasan a visitarse hoy
  disappearingToday: number; // asignaciones que dejan de visitarse hoy
  applied: boolean; // true solo si confirm = true
}
