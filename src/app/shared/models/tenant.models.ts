// Sedes y configuración (/api/tenant). Ver
// 21-panel-admin-usuarios-roles-catalogo-precios-inventario.md, sección 4.
// GET /api/tenant (datos de la empresa) está documentado como endpoint pero
// sin el detalle de su DTO — no se modela ni se usa acá hasta confirmarlo.

export interface BranchView {
  branchId: number;
  code: string;
  name: string;
  address: string;
  ubigeo: string; // INEI 6 dígitos
  active: boolean;
}
export interface CreateBranchCommand {
  code: string;
  name: string;
  address: string;
  ubigeo: string;
}

export interface ConfigView {
  configId: number;
  code: string;
  configGroup: string;
  configType: string; // BOOLEAN | NUMBER | TEXT
  value: string;
  description: string;
  updatedAt: string;
}
export interface UpsertConfigCommand {
  code: string;
  configGroup: string;
  configType: string;
  value: string;
  description: string;
}
