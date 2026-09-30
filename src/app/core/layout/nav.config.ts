// Menú de navegación. Cada ítem declara qué permiso(s) lo habilitan; el shell
// filtra por permisos (archivo 03). Ítems sin permisos (anyOf: []) siempre salen.

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

export const NAV: NavItem[] = [
  { label: 'Inicio', icon: 'home', route: '/dashboard', anyOf: [] },
  { label: 'Mi perfil', icon: 'person', route: '/mi-perfil', anyOf: [] },

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

  // Promos — módulo rediseñado, una sola entrada para las 5 pantallas
  {
    label: 'Promociones',
    icon: 'local_offer',
    route: '/promociones',
    anyOf: PROMO_ANY_PERMISSION,
    group: 'Promos',
  },
  {
    label: 'Segmentos',
    icon: 'group_work',
    route: '/segmentos',
    anyOf: ['segment.manage'],
    group: 'Promos',
  },

  // Reparto
  {
    label: 'Reparto',
    icon: 'local_shipping',
    route: '/reparto',
    anyOf: ['delivery.deliver', 'delivery.settle'],
    group: 'Reparto',
  },
  {
    label: 'Flota',
    icon: 'directions_car',
    route: '/flota',
    anyOf: ['delivery.settle'],
    group: 'Reparto',
  },

  // Facturación
  {
    label: 'Facturas',
    icon: 'description',
    route: '/facturas',
    anyOf: ['invoice.reconcile'],
    group: 'Facturación',
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
    anyOf: ['report.view', 'config.edit'],
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
    anyOf: ['config.edit'],
    group: 'Administración',
  },
  {
    label: 'Mantenimiento',
    icon: 'build',
    route: '/mantenimiento',
    anyOf: ['config.edit'],
    group: 'Administración',
  },
];
