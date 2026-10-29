// Constante de permisos — ARCHITECTURE_PANEL.md, sección 8.2 y regla de oro 6.
// Nace con el código nuevo del doc 51 (sección 17.3: "en código nuevo, los
// permisos se toman de PERMISSIONS"). No se retocan los archivos existentes
// que todavía usan el string suelto: eso es la migración de la Fase final
// (ARCHITECTURE_PANEL.md, sección 11), que no se ordenó acá.

export const PERMISSIONS = {
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_APPROVE: 'customer.approve',
  CUSTOMER_ASSIGN: 'customer.assign',
  ORDER_VIEW_ALL: 'order.view_all',
  ORDER_CREATE: 'order.create',
  ORDER_EDIT: 'order.edit',
  ORDER_MANAGE: 'order.manage',
  ORDER_CANCEL: 'order.cancel',
  ORDER_SEND_TO_BILLING: 'order.send_to_billing',
  PROMO_CREATE: 'promo.create',
  PROMO_APPROVE: 'promo.approve',
  PROMO_ALLOCATE: 'promo.allocate',
  PROMO_RESOLVE_CHOICE: 'promo.resolve_choice',
  SEGMENT_MANAGE: 'segment.manage',
  DELIVERY_DELIVER: 'delivery.deliver',
  DELIVERY_SETTLE: 'delivery.settle',
  DELIVERY_MANAGE: 'delivery.manage',
  INVOICE_RECONCILE: 'invoice.reconcile',
  NOTIFICATION_VIEW_ALL: 'notification.view_all',
  NOTIFICATION_SEND: 'notification.send',
  PRICE_VIEW: 'price.view',
  PRODUCT_EDIT: 'product.edit',
  REPORT_VIEW: 'report.view',
  CONFIG_EDIT: 'config.edit',
  STOCK_ADVANCE: 'stock.advance',
  USER_MANAGE: 'user.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
