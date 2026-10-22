// Contratos de Solicitudes de cliente (admin). Ver
// 13-panel-admin-clientes-solicitudes-cobertura-mapa.md — reemplaza el shape
// anterior (CreationRequest/FieldChangeRequest/ClosureRequest), que no
// coincidía con lo que expone el backend. Doc 31 agrega el registro del ERP
// a la creación. Doc 39 lo extiende a las tres solicitudes (creación, cambio
// de campo y cierre pasan todas por el ERP antes de poder aprobarse),
// agrega el ubigeo y las semanas del ciclo (obligatorias al aprobar).

/** Ubigeo ya resuelto con nombres — doc 39, sección 3.6. No se pide el catálogo: lo usa la app del vendedor. */
export interface UbigeoView {
  ubigeoCode: string; // código INEI de 6 dígitos — no se muestra
  department: string;
  province: string;
  district: string;
}

/** Fila del listado de creación — GET /creation/pending (doc 39, sección 5.2). */
export interface CreationRequestSummary {
  requestId: number;
  type: string; // siempre "CREATION" — no se usa
  businessName: string;
  status: string; // siempre "PENDING" en este listado
  requestedBy: number; // id — no se muestra
  requestedByName: string;
  createdAt: string; // ISO datetime
  resolvedAt: string | null; // null en este listado
  customerCode: string | null; // código del ERP; null mientras erpRegistered = false
  routeSequence: number | null; // secuencia de ruta del ERP; null mientras erpRegistered = false
  erpRegistered: boolean;
  erpRegisteredAt: string | null; // null mientras erpRegistered = false
  documentNumber: string;
  ubigeo: UbigeoView | null; // null en solicitudes antiguas
}

/** Detalle completo de una solicitud de creación — GET /creation/{requestId} (doc 39, sección 5.4). */
export interface CreationRequestDetail {
  requestId: number;
  businessName: string;
  documentTypeId: number; // ver catálogo DOCUMENT_TYPE_OPTIONS
  documentNumber: string;
  customerTypeId: number | null; // ver catálogo CUSTOMER_TYPE_OPTIONS; null = "Sin tipo"
  address: string | null;
  businessActivity: string | null;
  phone: string | null;
  latitude: number | null; // null si el vendedor no marcó la ubicación
  longitude: number | null;
  status: string;
  requestedBy: number; // id — no se muestra
  requestedByName: string;
  createdAt: string;
  resolvedAt: string | null;
  customerCode: string | null; // ERP
  routeSequence: number | null; // ERP
  erpRegistered: boolean; // ERP — true = ya se puede aprobar
  erpRegisteredAt: string | null;
  ubigeo: UbigeoView | null; // null en solicitudes antiguas
  assignedSalespersonId: number | null; // solo en aprobadas; id, no se muestra
  assignedSalespersonName: string | null; // solo en aprobadas
  visitDays: string | null; // solo en aprobadas, ej. "LXV" (sección 3.4)
  cycleWeeks: string | null; // solo en aprobadas, ej. "13" (sección 3.4)
  resolvedBy: number | null; // quién aprobó o rechazó; id, no se muestra
  resolvedByName: string | null;
}

/**
 * El código de cliente no se escribe acá: lo asigna el ERP y se lee de
 * CreationRequestDetail.customerCode. Días y semanas son obligatorios desde
 * doc 39 (antes los días eran opcionales y las semanas no existían).
 */
export interface ApproveCreationCommand {
  userId: number | null; // null = el vendedor que hizo la solicitud
  weekdays: number[]; // OBLIGATORIO, al menos uno, valores 1 a 7, sin repetir
  weeksOfCycle: number[]; // OBLIGATORIO, al menos uno, valores 1 a 4, sin repetir
}

/** Un campo dentro de un grupo de cambio — doc 39, sección 6.2. */
export interface FieldChangeView {
  requestId: number; // id — no se muestra
  fieldName: string; // traducir (sección 3.3)
  newValue: string;
  previousValue: string | null; // valor al momento de solicitar; null en antiguas o si estaba vacío
  erpRegistered: boolean; // el ERP ya aplicó ESTE campo
  erpRegisteredAt: string | null;
}

/** Grupo de cambio de campo — GET /field-change/pending, sin paginar (doc 39, sección 6.2). */
export interface FieldChangeGroupView {
  groupId: string; // identificador del grupo — no se muestra
  customerId: number; // id — no se muestra (sirve para "Ver ficha")
  businessName: string;
  reason: string | null; // motivo que escribió el vendedor
  status: string; // siempre "PENDING" en este listado
  requestedBy: number; // id — no se muestra
  requestedByName: string;
  createdAt: string;
  resolvedAt: string | null; // null en este listado
  changes: FieldChangeView[];
  customerCode: string | null;
  erpRegistered: boolean; // true = el ERP registró TODOS los campos
  erpRegisteredCount: number; // cuántos campos registró el ERP
}

/** Fila de cierre — GET /closure/pending (doc 39, sección 7.2). */
export interface RequestView {
  requestId: number; // id — no se muestra
  type: string; // siempre "CLOSURE" — no se usa
  customerId: number; // id — no se muestra (sirve para "Ver ficha")
  businessName: string;
  fieldName: string | null; // siempre null en cierre — no se usa
  newValue: string | null; // siempre null en cierre — no se usa
  reason: string | null; // motivo del cierre
  status: string; // siempre "PENDING" en este listado
  requestedBy: number; // id — no se muestra
  requestedByName: string;
  createdAt: string;
  resolvedAt: string | null; // null en este listado
  customerCode: string | null;
  erpRegistered: boolean; // el ERP ya dio de baja al cliente
  erpRegisteredAt: string | null;
}

export interface RequestListFilters {
  page?: number;
  size?: number;
}
