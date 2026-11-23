// Contratos de Notificaciones de supervisión (/api/notifications). Ver
// 36-panel-admin-pedido-dotacion-devoluciones-planilla-notificaciones.md,
// secciones 9-11.

export interface RecipientRoleView {
  code: string;
  name: string;
  activeUsers: number;
}

export interface RecipientView {
  userId: number;
  code: string;
  fullName: string;
  roleNames: string[];
}

export interface NotificationListFilters {
  roleCode?: string;
  userId?: number;
  read?: boolean;
  type?: string;
  from?: string; // yyyy-MM-dd
  to?: string;
  page?: number;
  size?: number;
}

export interface AdminNotificationView {
  notificationId: number;
  notificationType: string; // sección 3.4
  message: string;
  userId: number;
  userCode: string;
  userName: string;
  roleNames: string[];
  customerId: number | null;
  customerName: string | null;
  invoiceId: string | null;
  promoId: number | null;
  read: boolean;
  createdAt: string; // ISO datetime
  readAt: string | null;
  deliveredLive: boolean;
  broadcastId: number | null;
  sentByName: string | null;
}

export interface AdminNotificationPage {
  from: string; // yyyy-MM-dd, el rango realmente aplicado
  to: string;
  total: number; // todas las que cumplen rol/usuario/tipo/fechas, sin el filtro read
  unread: number; // de esas, sin leer
  notifications: import('./api.models').PageResponse<AdminNotificationView>;
}

export interface SendBroadcastCommand {
  message: string;
  roleCodes?: string[];
  userIds?: number[];
}

export interface BroadcastResult {
  broadcastId: number;
  recipients: number;
  deliveredLive: number;
  createdAt: string;
}

export interface BroadcastTargetView {
  targetType: 'ROLE' | 'USER';
  name: string;
}

export interface BroadcastSummary {
  broadcastId: number;
  message: string;
  sentById: number;
  sentByName: string;
  createdAt: string;
  targets: BroadcastTargetView[];
  recipients: number;
  read: number;
  unread: number;
}

export interface BroadcastRecipientView {
  notificationId: number;
  userId: number;
  userCode: string;
  userName: string;
  roleNames: string[];
  read: boolean;
  readAt: string | null;
  deliveredLive: boolean;
}

export interface BroadcastDetail extends BroadcastSummary {
  recipientList: BroadcastRecipientView[]; // primero quienes aún no lo leyeron
}

export interface BroadcastListFilters {
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}
