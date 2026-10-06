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
}

export interface UserSummaryView {
  userId: number;
  code: string;
  username: string;
  fullName: string;
  active: boolean;
  roleCodes: string[];
}

// — Autoservicio —

export interface UpdateProfileCommand {
  email?: string; // @Email, max 150
  phone?: string; // max 20
  profilePhotoUrl?: string; // max 300
}

export interface ChangePasswordCommand {
  currentPassword: string;
  newPassword: string; // 8-100
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
