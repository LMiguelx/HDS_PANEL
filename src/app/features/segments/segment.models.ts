// Contratos de Segmentos de clientes (CustomerSegmentController, /api/segments).
// Ver 28-panel-admin-promociones-segmentos-importacion.md, secciones 10-12.
// El api.ts generado quedó desactualizado para este controller (todavía
// describe segmentType/ruleDefinition/isActive y no trae archive/activate/
// import): se declaran acá las formas reales, a mano, como en sales-report.models.ts.

export interface CreateSegmentCommand {
  code: string; // obligatorio, máx. 30, único por tenant
  name: string; // obligatorio, máx. 100
}

export interface SegmentView {
  segmentId: number;
  code: string;
  name: string;
  active: boolean; // false = archivado
  memberCount: number;
  createdAt: string; // ISO datetime
}

export interface MemberView {
  customerId: number;
  code: string;
  businessName: string;
  documentNumber: string | null;
  customerActive: boolean; // false = cliente dado de baja
  source: 'MANUAL' | 'RULE_ENGINE';
  addedAt: string; // ISO datetime
}

export type ImportMode = 'ADD' | 'REPLACE';

export interface ImportMembersResult {
  totalRows: number;
  invalidRows: number;
  duplicatesInFile: number;
  matched: number;
  inactive: number;
  notFound: number;
  alreadyMembers: number;
  toAdd: number;
  toRemove: number;
  applied: boolean;
  notFoundSample: string[];
  invalidSample: string[];
}
