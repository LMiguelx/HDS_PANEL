// Contratos de Usuarios (/api/users). Ver
// 21-panel-admin-usuarios-roles-catalogo-precios-inventario.md, secciones 1-2.
// RoleView coincide con el `Role` ya definido en auth.models.ts (roleId,
// code, name) — se reusa ese en vez de duplicarlo acá.
import { Role } from './auth.models';

export interface UserView {
  userId: number;
  code: string;
  username: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string | null;
  fullName: string;
  homeBranchId: number | null;
  salesChannelId: number | null;
  active: boolean;
  roles: Role[];
  homeBranchName: string | null; // doc 38, sección 4.5
  salesChannelName: string | null;
  passwordChangedAt: string | null; // null si nunca la cambió
  nextPasswordChangeAt: string | null; // null si ya puede volver a cambiarla
  lastLoginAt: string | null; // null si nunca ingresó — doc 59, sección 1.2
}

export interface UserSummaryView {
  userId: number; // NO mostrar
  code: string;
  username: string;
  fullName: string;
  active: boolean;
  roleCodes: string[]; // se conserva por compatibilidad; NO usar para mostrar
  roles: Role[]; // NUEVO — roles con nombre: mostrar name
  lastLoginAt: string | null; // NUEVO — último ingreso; null = nunca ingresó
  routeStartedAt: string | null; // NUEVO — hora en que abrió jornada HOY; null = no la abrió
  routeEndedAt: string | null; // NUEVO — hora en que la cerró; null = sigue en jornada (o no la abrió)
}

/** doc 66, sección 4.2 — GET /api/users/summary. Tampoco cuenta al usuario que consulta. */
export interface UserSummaryCounts {
  total: number; // usuarios (cada uno una vez)
  active: number;
  inactive: number;
  onRouteToday: number; // abrieron jornada hoy
  byRole: RoleUserCount[]; // todos los roles activos, con 0 si no tienen usuarios; orden por nombre
}

export interface RoleUserCount {
  roleId: number; // NO mostrar
  roleCode: string; // NO mostrar; es el valor para el filtro roleCode
  roleName: string;
  total: number;
  active: number;
  onRouteToday: number;
}

// — Autoservicio —

export interface UpdateProfileCommand {
  email?: string; // @Email, max 150
  phone?: string; // max 20
  profilePhotoUrl?: string; // max 300
}

export interface ChangePasswordCommand {
  currentPassword: string;
  newPassword: string; // 4-100 (doc 38, sección 4.6 — antes el doc 21 decía 8-100)
}

// — Administración —

export interface CreateUserCommand {
  code: string; // obligatorio, max 10, único
  username: string; // obligatorio, max 60, único — login
  password: string; // obligatorio, 8-100
  email?: string;
  phone?: string;
  firstName: string; // obligatorio, max 80
  lastName?: string; // max 80
  homeBranchId?: number;
  salesChannelId: number; // obligatorio
  roleIds: number[]; // obligatorio, no vacío
}

export interface UserCreatedResult {
  userId: number;
  username: string;
}

export interface AdminUpdateUserCommand {
  firstName: string; // obligatorio, max 80
  lastName?: string;
  email?: string;
  phone?: string;
  homeBranchId?: number;
  salesChannelId: number; // obligatorio
}

export interface AdminResetPasswordCommand {
  newPassword: string; // 8-100
}

export interface AssignRolesCommand {
  roleIds: number[]; // obligatorio, no vacío
}
