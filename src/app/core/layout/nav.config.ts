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

  // Clientes
  {
    label: 'Clientes',
    icon: 'store',
    route: '/clientes',
    anyOf: ['customer.view'],
    group: 'Clientes',
    comingSoon: true,
  },
  {
    label: 'Aprobaciones',
    icon: 'how_to_reg',
    route: '/aprobaciones',
    anyOf: ['customer.approve'],
    group: 'Clientes',
    comingSoon: true,
  },
  {
    label: 'Asignaciones',
    icon: 'assignment_ind',
    route: '/asignaciones',
    anyOf: ['customer.assign'],
    group: 'Clientes',
    comingSoon: true,
  },
  {
    label: 'Segmentos',
    icon: 'group_work',
    route: '/segmentos',
    anyOf: ['segments.manage'],
    group: 'Clientes',
    comingSoon: true,
  },

  // Ventas
  {
    label: 'Pedidos',
    icon: 'receipt',
    route: '/pedidos',
    anyOf: ['order.view_all', 'order.create'],
    group: 'Ventas',
    comingSoon: true,
  },
  {
    label: 'Bonificaciones pendientes',
    icon: 'production_quantity_limits',
    route: '/pedidos/bonificaciones-pendientes',
    anyOf: ['order.view_all'],
    group: 'Ventas',
    comingSoon: true,
  },

  // Promos — módulo rediseñado, una sola entrada para las 5 pantallas
  {
    label: 'Promociones',
    icon: 'local_offer',
    route: '/promociones',
    anyOf: PROMO_ANY_PERMISSION,
    group: 'Promos',
  },

  // Reparto
  {
    label: 'Reparto',
    icon: 'local_shipping',
    route: '/reparto',
    anyOf: ['delivery.deliver', 'delivery.settle'],
    group: 'Reparto',
    comingSoon: true,
  },
  {
    label: 'Flota',
    icon: 'directions_car',
    route: '/flota',
    anyOf: ['delivery.settle'],
    group: 'Reparto',
    comingSoon: true,
  },

  // Facturación
  {
    label: 'Facturas',
    icon: 'description',
    route: '/facturas',
    anyOf: ['invoice.reconcile'],
    group: 'Facturación',
    comingSoon: true,
  },

  // Administración
  {
    label: 'Precios',
    icon: 'sell',
    route: '/precios',
    anyOf: ['price.view'],
    group: 'Administración',
    comingSoon: true,
  },
  {
    label: 'Inventario',
    icon: 'inventory',
    route: '/inventario',
    anyOf: ['report.view'],
    group: 'Administración',
    comingSoon: true,
  },
  {
    label: 'Empresa',
    icon: 'business',
    route: '/empresa',
    anyOf: ['config.edit'],
    group: 'Administración',
    comingSoon: true,
  },
];
