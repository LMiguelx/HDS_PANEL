// Contratos de Flota (/api/fleet). Ver 16-panel-supervision-reparto-facturas.md.
// Reemplaza el shape anterior (no confirmado con el backend real).

export interface VehicleView {
  vehicleId: number;
  branchId: number | null;
  code: string;
  plate: string;
  brandName: string | null;
  capacityKg: number | null;
  active: boolean;
}

export interface CreateVehicleCommand {
  branchId?: number;
  code: string; // obligatorio, máx 10
  plate: string; // obligatorio, máx 10
  brandName?: string; // máx 30
  capacityKg?: number; // mínimo 0.01
}

export interface TeamMemberView {
  userId: number;
  fullName: string;
  roleInTeam: string; // 'HELPER'
}

export interface TeamView {
  deliveryTeamId: number;
  vehicleId: number;
  vehiclePlate: string;
  driverUserId: number;
  driverName: string;
  effectiveFrom: string; // yyyy-MM-dd
  effectiveTo: string | null; // null = vigente
  members: TeamMemberView[];
}

export interface TeamMemberCommand {
  userId: number;
  roleInTeam: 'HELPER';
}

export interface CreateTeamCommand {
  vehicleId: number;
  driverUserId: number;
  effectiveFrom: string; // yyyy-MM-dd
  members?: TeamMemberCommand[]; // opcional, máx 2
}

export interface AvailableDriverView {
  userId: number;
  fullName: string;
}

export interface AvailableHelperView {
  userId: number;
  fullName: string;
}
