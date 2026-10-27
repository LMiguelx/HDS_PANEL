// Menú de navegación. Cada ítem declara qué permiso(s) lo habilitan; el shell
// filtra por permisos (archivo 03) y agrupa por `group` (doc 38, sección 5).
// Fuente de verdad única: no se repiten rutas ni permisos a mano en otro
// archivo (ARCHITECTURE_PANEL.md, regla 7).

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  anyOf: string[]; // basta tener uno
  group?: string; // agrupador visual
  /** Módulo todavía no rediseñado: se muestra apagado con «Próximamente». */
  comingSoon?: boolean;
}

/** Permisos que ya dan acceso a alguna pantalla del módulo de Promociones. */
export const PROMO_ANY_PERMISSION = ['promo.create', 'promo.approve', 'promo.allocate'];

/**
 * Ícono del grupo cuando está cerrado o expandido (solo el grupo lleva
 * ícono — doc 38, sección 5.2). Independiente de qué entradas sobrevivan
 * al filtro de permisos, para que un grupo reducido a una sola entrada
 * (enlace directo) conserve el ícono de su grupo.
 */
export const NAV_GROUP_ICONS: Record<string, string> = {
  Clientes: 'store',
  Ventas: 'shopping_cart',
  Promociones: 'local_offer',
  'Reparto y facturación': 'local_shipping',
  Administración: 'shield',
  Televentas: 'call',
};

/**
 * Menú del modo televentas (doc 42, sección 1.2): reemplaza a `NAV` entero
 * mientras `AuthService.isTelesalesMode()` — no se filtra ni se mezcla con
 * el resto, aunque algún permiso suelto del vendedor coincida con otra
 * pantalla (sección 1.1).
 */
export const TELEVENTAS_NAV: NavItem[] = [
  {
    label: 'Mi día',
    icon: 'today',
    route: '/televentas',
    anyOf: ['visit.register'],
    group: 'Televentas',
  },
  {
    label: 'Nuevo pedido',
    icon: 'add_shopping_cart',
    route: '/televentas/nuevo-pedido',
    anyOf: ['order.create'],
    group: 'Televentas',
  },
  {
    label: 'Mis pedidos',
    icon: 'receipt',
    route: '/televentas/mis-pedidos',
    anyOf: ['order.create'],
    group: 'Televentas',
  },
  {
    label: 'Liquidación del día',
    icon: 'payments',
    route: '/televentas/liquidacion',
    anyOf: ['order.create'],
    group: 'Televentas',
  },
  {
    label: 'Stock',
    icon: 'inventory_2',
    route: '/televentas/stock',
    anyOf: [],
    group: 'Televentas',
  },
];

export const NAV: NavItem[] = [
  { label: 'Inicio', icon: 'home', route: '/dashboard', anyOf: [] },

  // Clientes
  {
    label: 'Clientes',
    icon: 'store',
    route: '/clientes',
    anyOf: ['customer.view'],
    group: 'Clientes',
  },
  {
    label: 'Aprobaciones',
    icon: 'how_to_reg',
    route: '/aprobaciones',
    anyOf: ['customer.approve'],
    group: 'Clientes',
  },
  {
    label: 'Asignaciones',
    icon: 'assignment_ind',
    route: '/asignaciones',
    anyOf: ['customer.assign'],
    group: 'Clientes',
  },
  // Ventas
  {
    label: 'Pedidos',
    icon: 'receipt',
    route: '/pedidos',
    anyOf: ['order.view_all', 'order.create'],
    group: 'Ventas',
  },
  {
    label: 'Nuevo pedido',
    icon: 'add_shopping_cart',
    route: '/pedidos/nuevo',
    anyOf: ['order.manage'],
    group: 'Ventas',
  },
  {
    label: 'Bonificaciones pendientes',
    icon: 'production_quantity_limits',
    route: '/pedidos/bonificaciones-pendientes',
    anyOf: ['order.view_all'],
    group: 'Ventas',
  },
  {
    label: 'Reportes de ventas',
    icon: 'bar_chart',
    route: '/reportes-ventas',
    anyOf: ['order.view_all'],
    group: 'Ventas',
  },

  // Promociones — grupo propio, es el que más va a crecer (doc 38, 5.1)
  {
    label: 'Promociones',
    icon: 'local_offer',
    route: '/promociones',
    anyOf: PROMO_ANY_PERMISSION,
    group: 'Promociones',
  },
  {
    label: 'Simular pedido',
    icon: 'science',
    route: '/promociones/simular',
    anyOf: ['order.manage'],
    group: 'Promociones',
  },
  {
    label: 'Segmentos',
    icon: 'group_work',
    route: '/segmentos',
    anyOf: ['segment.manage'],
    group: 'Promociones',
  },

  // Reparto y facturación
  {
    label: 'Reparto',
    icon: 'local_shipping',
    route: '/reparto',
    anyOf: ['delivery.deliver', 'delivery.settle', 'delivery.manage'],
    group: 'Reparto y facturación',
  },
  {
    label: 'Flota',
    icon: 'directions_car',
    route: '/flota',
    anyOf: ['delivery.settle', 'delivery.manage'],
    group: 'Reparto y facturación',
  },
  {
    label: 'Validación de pedidos',
    icon: 'fact_check',
    route: '/validacion-facturacion',
    anyOf: ['order.send_to_billing'],
    group: 'Reparto y facturación',
  },
  {
    label: 'Facturas',
    icon: 'description',
    route: '/facturas',
    anyOf: ['invoice.reconcile'],
    group: 'Reparto y facturación',
  },

  // Administración
  {
    label: 'Catálogo y precios',
    icon: 'sell',
    route: '/precios',
    anyOf: ['price.view', 'product.edit'],
    group: 'Administración',
  },
  {
    label: 'Productos sin precio',
    icon: 'production_quantity_limits',
    route: '/precios/sin-precio',
    anyOf: ['product.edit'],
    group: 'Administración',
  },
  {
    label: 'Inventario',
    icon: 'inventory',
    route: '/inventario',
    anyOf: ['report.view', 'config.edit', 'stock.advance'],
    group: 'Administración',
  },
  // Acceso a Reportes de ventas para quien solo tiene `report.view` (p. ej.
  // Jefe de reparto) — doc 50, sección 4: no tiene `order.view_all`, así que
  // no ve la entrada de "Ventas", pero sí puede consultar estos reportes.
  {
    label: 'Reportes',
    icon: 'bar_chart',
    route: '/reportes-ventas',
    anyOf: ['report.view'],
    group: 'Administración',
  },
  {
    label: 'Usuarios',
    icon: 'group',
    route: '/usuarios',
    anyOf: ['user.manage'],
    group: 'Administración',
  },
  {
    label: 'Empresa',
    icon: 'business',
    route: '/empresa',
    anyOf: ['config.edit', 'system.maintenance.manage'],
    group: 'Administración',
  },
  {
    label: 'Notificaciones',
    icon: 'notifications',
    route: '/notificaciones',
    anyOf: ['notification.view_all', 'notification.send'],
    group: 'Administración',
  },
];
