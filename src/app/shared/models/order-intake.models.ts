// Cierre de la toma de pedidos — doc 65, sección 2. OrderIntakeController,
// /api/order-intake. Las fechas que se envían van sin zona horaria, hora de
// Lima: "yyyy-MM-ddTHH:mm:ss".

export type ClosureStatusCode = 'SCHEDULED' | 'ACTIVE' | 'FINISHED' | 'REOPENED' | 'CANCELLED';

/** Un cierre, con nombres listos para mostrar. */
export interface ClosureView {
  closureId: number;
  startsAt: string; // ISO, hora de Lima
  endsAt: string; // ISO
  reason: string | null;
  statusCode: ClosureStatusCode;
  statusName: string;
  changeable: boolean; // true = se puede extender, acortar, reabrir o anular
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedBy: number | null; // último cambio de la hora de fin
  updatedByName: string | null;
  updatedAt: string | null;
  endedBy: number | null; // quién lo reabrió o anuló
  endedByName: string | null;
  endedAt: string | null;
}

/** Estado de la toma de pedidos para quien pregunta. */
export interface IntakeStatusView {
  open: boolean; // true = no hay un cierre en curso
  blocksMe: boolean; // true = hay cierre en curso y ESTE usuario no puede operar pedidos
  serverTime: string; // hora del servidor (Lima); usar para cuentas regresivas
  current: ClosureView | null; // el cierre en curso
  next: ClosureView | null; // el próximo cierre programado
}

export interface ScheduleClosureCommand {
  startsAt: string | null; // null = desde ahora
  endsAt: string; // obligatorio
  reason: string | null; // opcional, máx. 200
}

export interface ChangeClosureEndCommand {
  endsAt: string; // obligatorio
}
