// Administración — empresa, sedes, configuración, mantenimiento. Archivo 07.

export interface TenantInfo {
  tenantId: number;
  legalName: string;
  tradeName: string;
  taxId: string; // RUC
  planCode: string;
  status: string;
  contactEmail: string;
  contactPhone: string;
}

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

export interface RecalculationResult {
  metricRows: number;
  summaryRows: number;
}
