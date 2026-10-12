import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { filter, map } from 'rxjs';
import { UiButton } from '../../../shared/ui/button/button';
import { UiMenu } from '../../../shared/ui/menu/menu';
import { UiToggle } from '../../../shared/ui/toggle/toggle';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { AuthService } from '../../auth/auth';
import { ThemeService } from '../../theme/theme.service';
import { NavHistoryService } from '../nav-history';
import { NAV, NAV_GROUP_ICONS, NavItem, PROMO_ANY_PERMISSION } from '../nav.config';
import { PendingCountStore } from '../../../features/promos/pending-count';
import { AssignmentAlertStore } from '../../../features/assignments/assignment-alerts';
import { RouteStore } from '../../../features/orders/route-store';
import { UserSelfService } from '../../../features/users/user-self';
import { MaintenanceService } from '../../maintenance/maintenance.service';
import { timeText } from '../../../features/assignments/assignment-format';

const SIDEBAR_COLLAPSED_KEY = 'hds.sidebarCollapsed';

interface NavGroupVm {
  name: string;
  icon: string;
  items: NavItem[];
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UiButton, UiMenu, UiToggle],
  templateUrl: './shell.html',
  styleUrls: ['./shell.scss'],
})
export class ShellComponent {
  private auth = inject(AuthService);
  private breakpoints = inject(BreakpointObserver);
  private dialog = inject(UiDialogService);
  private router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly navHistory = inject(NavHistoryService);
  readonly pendingCount = inject(PendingCountStore);
  readonly assignmentAlerts = inject(AssignmentAlertStore);
  readonly routeStore = inject(RouteStore);
  readonly userSelf = inject(UserSelfService);
  readonly maintenance = inject(MaintenanceService);

  readonly user = this.auth.currentUser;
  readonly drawerOpen = signal(false);
  readonly showJornada = computed(() => this.auth.hasAny('order.manage'));

  readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  readonly collapsed = signal(this.readCollapsedPref());
  readonly openGroup = signal<string | null>(null);
  readonly hoveredGroup = signal<string | null>(null);
  readonly userMenuOpen = signal(false);
  readonly searchQuery = signal('');
  readonly searchActiveIndex = signal(0);

  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly userInitials = computed(() => {
    const p = this.userSelf.profile();
    if (p) {
      const a = p.firstName?.trim().charAt(0) ?? '';
      const b = p.lastName?.trim().charAt(0) ?? '';
      const initials = (a + b).toUpperCase();
      if (initials) return initials;
    }
    const name = this.user()?.fullName || this.user()?.username || '';
    return name.charAt(0).toUpperCase() || '?';
  });

  readonly userRoleNames = computed(() => {
    const roles = this.userSelf.profile()?.roles;
    return roles?.length ? roles.map((r) => r.name).join(', ') : '';
  });

  readonly jornadaLabel = computed(() => {
    const r = this.routeStore.route();
    return r ? `Jornada abierta desde las ${timeText(r.startTime)}` : '';
  });

  readonly canManageMaintenance = computed(() => this.auth.hasAny('system.maintenance.manage'));

  /** Ítems sin grupo (hoy solo "Inicio"): enlace directo, sin flecha ni ícono de grupo. */
  readonly directItems = computed(() =>
    NAV.filter((i) => !i.group && this.auth.hasAny(...i.anyOf)),
  );

  /** Ítems agrupados visibles por permiso, con el ícono fijo de su grupo. */
  readonly groups = computed<NavGroupVm[]>(() => {
    const visible = NAV.filter((i) => i.group && this.auth.hasAny(...i.anyOf));
    const byGroup = new Map<string, NavItem[]>();
    for (const item of visible) {
      const key = item.group!;
      (byGroup.get(key) ?? byGroup.set(key, []).get(key)!).push(item);
    }
    return Array.from(byGroup, ([name, items]) => ({
      name,
      icon: NAV_GROUP_ICONS[name] ?? 'folder',
      items,
    }));
  });

  private normalizedQuery = computed(() => normalize(this.searchQuery()));
  readonly isSearching = computed(() => this.normalizedQuery().length > 0);

  readonly visibleDirectItems = computed(() => {
    const q = this.normalizedQuery();
    if (!q) return this.directItems();
    return this.directItems().filter((i) => normalize(i.label).includes(q));
  });

  /** Mientras se busca, el acordeón se suspende: se abren todos los grupos con coincidencias. */
  readonly visibleGroups = computed<NavGroupVm[]>(() => {
    const q = this.normalizedQuery();
    if (!q) return this.groups();
    return this.groups()
      .map((g) => {
        const groupMatches = normalize(g.name).includes(q);
        const items = groupMatches
          ? g.items
          : g.items.filter((i) => normalize(i.label).includes(q));
        return { ...g, items };
      })
      .filter((g) => g.items.length > 0);
  });

  /** Orden de lectura (directos + cada grupo), para Enter y las flechas del buscador. */
  readonly searchMatches = computed<NavItem[]>(() => {
    if (!this.isSearching()) return [];
    return [...this.visibleDirectItems(), ...this.visibleGroups().flatMap((g) => g.items)];
  });

  private badgeByRoute = computed<Record<string, number>>(() => ({
    '/promociones': this.pendingCount.count() ?? 0,
    '/asignaciones': this.assignmentAlerts.count() ?? 0,
  }));

  constructor() {
    if (this.auth.hasAny(...PROMO_ANY_PERMISSION)) {
      this.pendingCount.refresh();
    }
    if (this.auth.hasAny('customer.assign')) {
      this.assignmentAlerts.refresh();
    }
    if (this.showJornada()) {
      this.routeStore.refresh();
    }
    this.userSelf.refresh();
    if (this.canManageMaintenance()) {
      this.maintenance.refresh();
      this.maintenance.startPolling();
      inject(DestroyRef).onDestroy(() => this.maintenance.stopPolling());
    }
    // Al pasar a escritorio el cajón deja de tener sentido.
    effect(() => {
      if (!this.isHandset()) this.drawerOpen.set(false);
    });
    // Abre el grupo de la ruta activa al cargar o navegar, y cierra lo que
    // haya quedado abierto de la navegación anterior (menú del usuario,
    // búsqueda, cajón móvil).
    effect(() => {
      const url = this.currentUrl();
      untracked(() => {
        const match = this.groups().find((g) =>
          g.items.some((i) => url === i.route || url.startsWith(i.route + '/')),
        );
        if (match) this.openGroup.set(match.name);
        this.userMenuOpen.set(false);
        this.searchQuery.set('');
        this.closeDrawer();
      });
    });
  }

  private readCollapsedPref(): boolean {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  protected toggleCollapsed() {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      /* localStorage no disponible: el panel arranca expandido la próxima vez. */
    }
  }

  protected toggleGroup(name: string) {
    this.openGroup.update((cur) => (cur === name ? null : name));
  }

  /** Solo abre el flotante con el menú contraído en escritorio (ARCHITECTURE_PANEL 8.9: los manejadores no devuelven valor, la condición se guarda adentro). */
  protected onGroupHoverEnter(name: string): void {
    if (this.collapsed() && !this.isHandset()) this.hoveredGroup.set(name);
  }

  protected onGroupHoverLeave(): void {
    this.hoveredGroup.set(null);
  }

  protected badgeFor(item: NavItem): number {
    return this.badgeByRoute()[item.route] ?? 0;
  }

  protected groupBadge(group: NavGroupVm): number {
    return group.items.reduce((sum, i) => sum + this.badgeFor(i), 0);
  }

  protected toggleUserMenu() {
    this.userMenuOpen.update((v) => !v);
  }

  protected onSearchInput(ev: Event) {
    this.searchQuery.set((ev.target as HTMLInputElement).value);
    this.searchActiveIndex.set(0);
  }

  protected onSearchKeydown(ev: KeyboardEvent) {
    const matches = this.searchMatches();
    if (ev.key === 'Escape') {
      this.searchQuery.set('');
      (ev.target as HTMLInputElement).blur();
      return;
    }
    if (!matches.length) return;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.searchActiveIndex.update((i) => Math.min(i + 1, matches.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.searchActiveIndex.update((i) => Math.max(i - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const item = matches[this.searchActiveIndex()];
      if (item) this.router.navigateByUrl(item.route);
    }
  }

  closeDrawer() {
    if (this.isHandset()) this.drawerOpen.set(false);
  }

  logout() {
    this.auth.logout();
  }

  protected openJornada() {
    this.routeStore.start();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(ev: KeyboardEvent) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (this.collapsed() && !this.isHandset()) {
        this.collapsed.set(false);
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '0');
        } catch {
          /* localStorage no disponible: no persiste, pero igual se expande ahora. */
        }
      }
      if (this.isHandset()) this.drawerOpen.set(true);
      setTimeout(() => this.searchInput()?.nativeElement.focus());
      return;
    }
    if (ev.key === 'Escape' && this.userMenuOpen()) {
      this.userMenuOpen.set(false);
      return;
    }
    if (!ev.altKey) return;
    if (ev.key === 'ArrowLeft' && this.navHistory.canGoBack()) {
      ev.preventDefault();
      this.navHistory.back();
    } else if (ev.key === 'ArrowRight' && this.navHistory.canGoForward()) {
      ev.preventDefault();
      this.navHistory.forward();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(ev: MouseEvent) {
    if (!this.userMenuOpen()) return;
    const target = ev.target as HTMLElement;
    if (!target.closest('.user-menu-wrap')) this.userMenuOpen.set(false);
  }

  protected closeJornada() {
    this.dialog
      .confirm({
        title: 'Cerrar jornada',
        message:
          'Con la jornada cerrada no podrás registrar más pedidos de mostrador hasta mañana. ¿Cerrarla?',
        confirmLabel: 'Cerrar jornada',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.routeStore.end();
      });
  }
}
