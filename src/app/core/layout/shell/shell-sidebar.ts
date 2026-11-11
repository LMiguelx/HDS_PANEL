import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { filter, map } from 'rxjs';
import { AuthService } from '../../auth/auth';
import { MobileDrawerState } from '../mobile-drawer.state';
import { NAV, NAV_GROUP_ICONS, NavItem, PROMO_ANY_PERMISSION, TELEVENTAS_NAV } from '../nav.config';
import { PendingCountStore } from '../../../features/promos/pending-count';
import { AssignmentAlertStore } from '../../../features/assignments/assignment-alerts';

const SIDEBAR_COLLAPSED_KEY = 'hds.sidebarCollapsed';

interface NavGroupVm {
  name: string;
  icon: string;
  items: NavItem[];
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Menú lateral agrupado: buscador Ctrl K, acordeón (un solo grupo abierto,
 * se abre solo el de la ruta activa), modo contraído con flotante. Separado
 * de `ShellComponent` solo por el presupuesto `anyComponentStyle` (ver
 * `shell.ts`) — inyecta sus propios servicios en vez de recibirlos por
 * `input()`, igual que `ShellTopbar`.
 */
@Component({
  selector: 'app-shell-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './shell-sidebar.html',
  styleUrls: ['./shell-sidebar.scss'],
})
export class ShellSidebar {
  private auth = inject(AuthService);
  private router = inject(Router);
  private breakpoints = inject(BreakpointObserver);
  readonly drawer = inject(MobileDrawerState);
  readonly pendingCount = inject(PendingCountStore);
  readonly assignmentAlerts = inject(AssignmentAlertStore);

  readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  readonly collapsed = signal(this.readCollapsedPref());
  readonly openGroup = signal<string | null>(null);
  readonly hoveredGroup = signal<string | null>(null);
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

  /**
   * Modo televentas (doc 42, sección 1.1): reemplaza el menú entero por
   * `TELEVENTAS_NAV`, sin mezclar con el resto aunque algún permiso suelto
   * coincida con otra pantalla.
   */
  private navSource = computed<NavItem[]>(() =>
    this.auth.isTelesalesMode() ? TELEVENTAS_NAV : NAV,
  );

  /** Ítems sin grupo (hoy solo "Inicio"): enlace directo, sin flecha ni ícono de grupo. */
  readonly directItems = computed(() =>
    this.navSource().filter((i) => !i.group && this.auth.hasAny(...i.anyOf)),
  );

  /** Ítems agrupados visibles por permiso, con el ícono fijo de su grupo. */
  readonly groups = computed<NavGroupVm[]>(() => {
    const visible = this.navSource().filter((i) => i.group && this.auth.hasAny(...i.anyOf));
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
    // Abre el grupo de la ruta activa al cargar o navegar, y cierra lo que
    // haya quedado abierto de la navegación anterior (búsqueda, cajón móvil).
    effect(() => {
      const url = this.currentUrl();
      untracked(() => {
        const match = this.groups().find((g) =>
          g.items.some((i) => url === i.route || url.startsWith(i.route + '/')),
        );
        if (match) this.openGroup.set(match.name);
        this.searchQuery.set('');
        this.drawer.close();
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

  protected closeDrawer() {
    this.drawer.close();
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
      if (this.isHandset()) this.drawer.open.set(true);
      setTimeout(() => this.searchInput()?.nativeElement.focus());
    }
  }
}
