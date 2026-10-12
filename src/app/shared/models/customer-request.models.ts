// Contratos de Solicitudes de cliente (admin). Ver
// 13-panel-admin-clientes-solicitudes-cobertura-mapa.md — reemplaza el shape
// anterior (CreationRequest/FieldChangeRequest/ClosureRequest), que no
// coincidía con lo que expone el backend. Doc 31 agrega el registro del ERP
// a la creación (customerCode/routeSequence/erpRegistered/erpRegisteredAt).

/**
 * Fila de creación o de cierre — mismo shape, distinto `type`. En creación
 * `fieldName`/`newValue`/`reason` siempre llegan vacíos — no se leen ahí.
 * `customerCode`/`routeSequence`/`erpRegisteredAt` son null hasta que el ERP
 * registra al cliente (ver `erpRegistered`, doc 31 sección 3.1).
 */
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
  customerCode: string | null;
  routeSequence: number | null;
  erpRegistered: boolean;
  erpRegisteredAt: string | null;
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
  customerTypeId: number | null; // ver catálogo CUSTOMER_TYPE_OPTIONS; null = "Sin tipo"
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
  customerCode: string | null; // código que asignó el ERP; null si aún no la registró
  routeSequence: number | null; // secuencia de ruta que asignó el ERP; null si aún no la registró
  erpRegistered: boolean; // true = ya se puede aprobar (sección 3.1)
  erpRegisteredAt: string | null; // null si el ERP aún no la registró
}

/**
 * El código de cliente ya no se escribe acá: lo asigna el ERP y se lee de
 * CreationRequestDetail.customerCode (doc 31, sección 7.1). El body es
 * obligatorio aunque vaya vacío ({}).
 */
export interface ApproveCreationCommand {
  userId?: number | null; // null u omitido = el vendedor que hizo la solicitud
  weekdays?: number[]; // opcional — días de visita, valores 1 a 7
}

export interface RequestListFilters {
  page?: number;
  size?: number;
}
