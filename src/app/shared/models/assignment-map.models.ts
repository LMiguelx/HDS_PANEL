// Contratos del mapa de asignaciones — doc 40
// (40-panel-admin-mapa-asignaciones-general-vendedor-global.md). Reemplaza
// MapCustomerView/MapVisitView/MapRouteView/MapResponse/MapQuery de
// assignment-admin.models.ts (GET /api/admin/assignments/map, obsoleto) y a
// GET /api/routes/today/plan, que el mapa deja de usar. OrphanCustomerView
// sigue viviendo en assignment-admin.models.ts: no cambió.

/** Resultado de la visita del día — sección 2.2/3.5. */
export type MapPointStatus = 'PENDING' | 'ORDERED' | 'NO_ORDER' | 'CLOSED';

/** Jornada del vendedor — sección 3.6. */
export type MapRouteStatus = 'NOT_STARTED' | 'IN_ROUTE' | 'FINISHED';

/** Alertas de la bitácora — sección 3.7. */
export type MapAlertType = 'OFF_PLAN' | 'FAR_FROM_CUSTOMER' | 'LONG_PAUSE' | 'NO_LOCATION';

/** Vendedor, igual en las tres vistas — sección 5.2. */
export interface MapVendorSummary {
  userId: number; // id — no se muestra; para filtros, URL y clic
  code: string;
  userName: string;
  mapColor: number | null; // color fijo (sección 3.1); null = gris
  routeStatus: MapRouteStatus;
  routeStartedAt: string | null;
  routeEndedAt: string | null;
  counters: MapDayCounters;
}

export interface MapDayCounters {
  planned: number;
  pending: number;
  visited: number;
  ordered: number;
  noOrder: number;
  closed: number;
  offPlan: number;
  withoutLocation: number;
  orderAmount: number;
}

/** Un punto de la vista general — sección 5.2. Sin nombre: llega al hacer clic. */
export interface MapPointView {
  customerId: number; // id — no se muestra; para el clic
  latitude: number;
  longitude: number;
  userId: number | null; // dueño del punto (plan o quien lo visitó)
  status: MapPointStatus;
  offPlan: boolean;
}

export interface MapOverviewResponse {
  date: string; // yyyy-MM-dd
  weekday: number; // 1 = lunes … 7 = domingo
  weekOfCycle: number; // 1 a 4
  vendors: MapVendorSummary[];
  points: MapPointView[];
  totals: MapDayCounters;
  orphanCount: number;
}

/** Cliente del plan de un vendedor (o visitado fuera de plan) — sección 6.2. */
export interface MapStopView {
  customerId: number;
  code: string;
  customerName: string;
  latitude: number | null; // null = sin ubicación, no sale en el mapa
  longitude: number | null;
  routeSequence: number | null; // null en los fuera de plan
  planned: boolean; // true = estaba en su plan
  covered: boolean; // true = lo cubre hoy por ausencia de otro
  status: MapPointStatus; // de su última visita del día (de quien sea)
  offPlan: boolean;
  lastVisitAt: string | null;
  lastVisitUserId: number | null; // si ≠ vendedor, la hizo otro
}

/** Una fila de la bitácora — sección 6.2. */
export interface MapLogEntryView {
  visitId: number; // id — no se muestra; para /track y el clic
  visitedAt: string;
  customerId: number; // id — no se muestra
  customerCode: string;
  customerName: string;
  status: MapPointStatus; // resultado de ESTA visita
  visitStatusName: string;
  visitReasonName: string | null;
  orderId: number | null; // id — no se muestra; habilita "Ver pedido"
  orderNetAmount: number | null;
  orderStatusCode: string | null; // OPEN · SENT_TO_BILLING · CANCELLED · COUNTER_DELIVERED
  latitude: number | null; // GPS de la visita; null = sin GPS
  longitude: number | null;
  distanceMeters: number | null; // distancia del GPS a la ubicación del cliente
  minutesSincePrevious: number | null;
  offPlan: boolean;
  alerts: MapAlertType[];
}

export type MapPathPointKind = 'START' | 'VISIT' | 'END';

export interface MapPathPoint {
  kind: MapPathPointKind;
  at: string;
  latitude: number;
  longitude: number;
  visitId: number | null; // solo en VISIT
}

export interface MapAlertSummary {
  offPlan: number;
  farFromCustomer: number;
  longPause: number;
  noLocation: number;
}

export interface MapAlertThresholds {
  farFromCustomerMeters: number; // hoy 150
  longPauseMinutes: number; // hoy 40
}

export interface MapVendorDayResponse {
  date: string;
  weekday: number;
  weekOfCycle: number;
  vendor: MapVendorSummary;
  stops: MapStopView[];
  path: MapPathPoint[];
  log: MapLogEntryView[];
  alerts: MapAlertSummary;
  thresholds: MapAlertThresholds;
  currentPauseMinutes: number | null; // solo hoy con ruta abierta
  idleAlert: boolean;
  lastVisitId: number | null; // se envía como afterVisitId en /track
}

export interface MapVendorTrackResponse {
  date: string;
  vendor: MapVendorSummary; // completo: reemplazar
  changedStops: MapStopView[]; // clientes con alguna visita nueva
  path: MapPathPoint[]; // recorrido completo: reemplazar
  newEntries: MapLogEntryView[]; // sus visitas nuevas, en orden de hora
  alerts: MapAlertSummary; // completo: reemplazar
  currentPauseMinutes: number | null;
  idleAlert: boolean;
  lastVisitId: number | null; // guardar para la próxima llamada
  reloadRequired: boolean; // true = pedir /day de nuevo y reemplazar todo
}

export interface MapVendorInfo {
  userId: number; // id — no se muestra
  code: string;
  userName: string;
  mapColor: number | null;
}

export interface MapPortfolioCustomerView {
  customerId: number; // id — no se muestra
  code: string;
  customerName: string;
  latitude: number | null;
  longitude: number | null;
  routeSequence: number | null;
  weekdays: number[]; // vacío = sin días
  weeksOfCycle: number[]; // vacío = sin semanas
  scheduledOnDate: boolean; // le toca en la fecha y nadie más lo cubre
  coveredByUserId: number | null; // id — no se muestra
  status: MapPointStatus; // resultado de la fecha
  lastVisitAt: string | null;
}

export interface MapWeekdayLoad {
  weekday: number;
  customers: number;
}

export interface MapPortfolioResponse {
  date: string;
  weekday: number;
  weekOfCycle: number;
  vendor: MapVendorInfo;
  customers: MapPortfolioCustomerView[]; // toda la cartera vigente, por secuencia
  byWeekday: MapWeekdayLoad[]; // lun a dom
  scheduledOnDate: number; // cuántos le tocan en la fecha
  withoutSchedule: number; // sin días o sin semanas
  withoutLocation: number; // sin coordenadas
}

/** Un punto de la vista de día global — sección 9.2. */
export interface MapGlobalPointView {
  customerId: number; // id — no se muestra; para el clic
  latitude: number;
  longitude: number;
  userId: number | null; // quien lo cubre en la fecha o su dueño; null = sin vendedor
  scheduled: boolean; // estaba en el plan de alguien ese día
  status: MapPointStatus;
  offPlan: boolean;
}

export interface MapGlobalTotals {
  customers: number;
  withoutLocation: number;
  orphans: number;
  scheduled: number;
  scheduledPending: number;
  visited: number;
  ordered: number;
  noOrder: number;
  closed: number;
  offPlan: number;
  orderCount: number;
  orderAmount: number;
}

export interface MapGlobalResponse {
  date: string;
  weekday: number;
  weekOfCycle: number;
  vendors: MapVendorInfo[]; // leyenda de colores
  points: MapGlobalPointView[];
  totals: MapGlobalTotals;
}

/** Una visita de la ventana del punto — sección 10.2. */
export interface MapCustomerVisitView {
  visitId: number; // id — no se muestra
  visitedAt: string;
  userId: number; // id — no se muestra
  userName: string; // quién lo visitó
  status: MapPointStatus;
  visitStatusName: string;
  visitReasonName: string | null;
  orderId: number | null; // id — no se muestra; habilita "Ver pedido"
  orderNetAmount: number | null;
  orderStatusCode: string | null;
  orderStatusName: string | null; // "Abierto, editable", "Anulado"…
  distanceMeters: number | null;
}

export interface MapCustomerPopupView {
  customerId: number; // id — no se muestra; para "Ver ficha"
  code: string;
  customerName: string;
  address: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  active: boolean; // false = cliente cerrado (inactivo)
  owner: MapVendorInfo | null; // null = sin vendedor
  coveringBy: MapVendorInfo | null; // null = nadie
  weekdays: number[];
  weeksOfCycle: number[];
  date: string;
  scheduledOnDate: boolean;
  status: MapPointStatus;
  offPlan: boolean;
  visits: MapCustomerVisitView[]; // todas sus visitas de la fecha, en orden
}
