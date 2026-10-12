import {
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
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
import { MobileDrawerState } from '../mobile-drawer.state';
import { RouteStore } from '../../../features/orders/route-store';
import { UserSelfService } from '../../../features/users/user-self';
import { MaintenanceService } from '../../maintenance/maintenance.service';
import { timeText } from '../../../features/assignments/assignment-format';

/**
 * Barra superior: marca, historial, aviso de mantenimiento, jornada,
 * campana y el menú del usuario. Separada de `ShellComponent` solo para
 * no pasarse del presupuesto `anyComponentStyle` (ver `shell.ts`); cada
 * pieza de estado se inyecta directo (son servicios `providedIn: 'root'`),
 * así que no hace falta pasarle nada por `input()`.
 */
@Component({
  selector: 'app-shell-topbar',
  imports: [RouterLink, UiButton, UiMenu, UiToggle],
  templateUrl: './shell-topbar.html',
  styleUrls: ['./shell-topbar.scss'],
})
export class ShellTopbar {
  private auth = inject(AuthService);
  private dialog = inject(UiDialogService);
  private router = inject(Router);
  private breakpoints = inject(BreakpointObserver);
  readonly drawer = inject(MobileDrawerState);
  readonly theme = inject(ThemeService);
  readonly navHistory = inject(NavHistoryService);
  readonly routeStore = inject(RouteStore);
  readonly userSelf = inject(UserSelfService);
  readonly maintenance = inject(MaintenanceService);

  readonly user = this.auth.currentUser;
  readonly showJornada = computed(() => this.auth.hasAny('order.manage'));
  readonly canManageMaintenance = computed(() => this.auth.hasAny('system.maintenance.manage'));
  readonly userMenuOpen = signal(false);

  readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

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

  constructor() {
    this.userSelf.refresh();
    if (this.showJornada()) {
      this.routeStore.refresh();
    }
    if (this.canManageMaintenance()) {
      this.maintenance.refresh();
      this.maintenance.startPolling();
      inject(DestroyRef).onDestroy(() => this.maintenance.stopPolling());
    }
    // Cierra el menú del usuario al navegar, igual que antes de separar el shell.
    effect(() => {
      this.currentUrl();
      this.userMenuOpen.set(false);
    });
  }

  protected toggleUserMenu() {
    this.userMenuOpen.update((v) => !v);
  }

  protected openJornada() {
    this.routeStore.start();
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

  logout() {
    this.auth.logout();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(ev: KeyboardEvent) {
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
}
