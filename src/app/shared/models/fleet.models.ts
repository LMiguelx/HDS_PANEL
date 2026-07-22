// Flota — vehículos y equipos. Archivo 06.
// El shape de /fleet/teams y /fleet/vehicles no está detallado → confírmalo con el Swagger.

export interface TeamMemberView {
  userId?: number;
  userName?: string | null;
  roleInTeam: string; // HELPER | CO_DRIVER
}

export interface TeamView {
  deliveryTeamId: number;
  driverName: string;
  vehiclePlate: string;
  vehicleCode?: string | null;
  capacityKg?: number | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  members?: TeamMemberView[];
}

export interface VehicleView {
  vehicleId: number;
  code: string;
  plate: string;
  brandName?: string | null;
  capacityKg: number;
  active: boolean;
}

// ── Comandos ──────────────────────────────────────────────────────────────
export interface CreateVehicleCommand {
  branchId: number;
  code: string;
  plate: string;
  brandName?: string;
  capacityKg: number;
}

export interface CreateTeamMember {
  userId: number;
  roleInTeam: string; // HELPER | CO_DRIVER
}

export interface CreateTeamCommand {
  vehicleId: number;
  driverUserId: number;
  effectiveFrom: string;
  members: CreateTeamMember[];
}
