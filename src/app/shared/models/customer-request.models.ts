// Contratos de Solicitudes de cliente (admin). Ver
// 13-panel-admin-clientes-solicitudes-cobertura-mapa.md — reemplaza el shape
// anterior (CreationRequest/FieldChangeRequest/ClosureRequest), que no
// coincidía con lo que expone el backend.

/** Fila de creación o de cierre — mismo shape, distinto `type`. */
export interface RequestView {
  requestId: number;
  type: string; // 'CREATION' | 'CLOSURE'
  customerId: number | null; // null en creación (el cliente todavía no existe)
  businessName: string;
  fieldName: string | null;
  newValue: string | null;
  reason: string | null;
  status: string;
  requestedBy: number;
  requestedByName: string;
  createdAt: string; // ISO datetime
  resolvedAt: string | null;
}

export interface FieldChangeView {
  requestId: number;
  fieldName: string;
  newValue: string;
}

export interface FieldChangeGroupView {
  groupId: string;
  customerId: number;
  businessName: string;
  reason: string | null;
  status: string;
  requestedBy: number;
  requestedByName: string;
  createdAt: string;
  resolvedAt: string | null;
  changes: FieldChangeView[];
}

/** Detalle completo de una solicitud de creación pendiente — GET /creation/{requestId}. */
export interface CreationRequestDetail {
  requestId: number;
  businessName: string;
  documentTypeId: number; // ver catálogo DOCUMENT_TYPE_OPTIONS
  documentNumber: string;
  customerTypeId: number; // ver catálogo CUSTOMER_TYPE_OPTIONS
  address: string | null;
  businessActivity: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  requestedBy: number;
  requestedByName: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ApproveCreationCommand {
  customerCode: string; // obligatorio, máx 10 caracteres
  userId?: number;
  weekdays?: number[]; // ISO 1..7
}

export interface RequestListFilters {
  page?: number;
  size?: number;
}
