// Menú de navegación. Cada ítem declara qué permiso(s) lo habilitan; el shell
// filtra por permisos (archivo 03). Ítems sin permisos (anyOf: []) siempre salen.

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  anyOf: string[]; // basta tener uno
  group?: string; // agrupador visual
}

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
  {
    label: 'Segmentos',
    icon: 'group_work',
    route: '/segmentos',
    anyOf: ['segments.manage'],
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

  // Promos
  {
    label: 'Promociones',
    icon: 'local_offer',
    route: '/promos',
    anyOf: ['promo.create', 'promo.approve'],
    group: 'Promos',
  },
  {
    label: 'Dotaciones',
    icon: 'redeem',
    route: '/dotaciones',
    anyOf: ['promo.allocate'],
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
    label: 'Precios',
    icon: 'sell',
    route: '/precios',
    anyOf: ['price.view'],
    group: 'Administración',
  },
  {
    label: 'Inventario',
    icon: 'inventory',
    route: '/inventario',
    anyOf: ['report.view'],
    group: 'Administración',
  },
  {
    label: 'Empresa',
    icon: 'business',
    route: '/empresa',
    anyOf: ['config.edit'],
    group: 'Administración',
  },
];
