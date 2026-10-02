import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { UiButton } from '../../../shared/ui/button/button';
import { UiMenu } from '../../../shared/ui/menu/menu';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { AuthService } from '../../auth/auth';
import { ThemeService } from '../../theme/theme.service';
import { NAV, NavItem, PROMO_ANY_PERMISSION } from '../nav.config';
import { PendingCountStore } from '../../../features/promos/pending-count';
import { AssignmentAlertStore } from '../../../features/assignments/assignment-alerts';
import { RouteStore } from '../../../features/orders/route-store';
import { timeText } from '../../../features/assignments/assignment-format';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UiButton, UiMenu],
  templateUrl: './shell.html',
  styleUrls: ['./shell.scss'],
})
export class ShellComponent {
  private auth = inject(AuthService);
  private breakpoints = inject(BreakpointObserver);
  private dialog = inject(UiDialogService);
  readonly theme = inject(ThemeService);
  readonly pendingCount = inject(PendingCountStore);
  readonly assignmentAlerts = inject(AssignmentAlertStore);
  readonly routeStore = inject(RouteStore);

  readonly user = this.auth.currentUser;
  readonly drawerOpen = signal(false);
  readonly showJornada = computed(() => this.auth.hasAny('order.manage'));

  readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  readonly themeLabel = computed(() => (this.theme.resolved() === 'dark' ? 'Claro' : 'Oscuro'));
  readonly userInitial = computed(() => {
    const name = this.user()?.fullName || this.user()?.username || '';
    return name.charAt(0).toUpperCase() || '?';
  });
  readonly jornadaLabel = computed(() => {
    const r = this.routeStore.route();
    return r ? `Jornada abierta desde las ${timeText(r.startTime)}` : '';
  });

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
    // Al pasar a escritorio el cajón deja de tener sentido.
    effect(() => {
      if (!this.isHandset()) this.drawerOpen.set(false);
    });
  }

  /** Ítems visibles según permisos, agrupados por 'group'. */
  readonly groups = computed(() => {
    const visible = NAV.filter((i) => this.auth.hasAny(...i.anyOf));
    const byGroup = new Map<string, NavItem[]>();
    for (const item of visible) {
      const key = item.group ?? '';
      (byGroup.get(key) ?? byGroup.set(key, []).get(key)!).push(item);
    }
    return Array.from(byGroup, ([name, items]) => ({ name, items }));
  });

  closeDrawer() {
    if (this.isHandset()) this.drawerOpen.set(false);
  }

  logout() {
    this.auth.logout();
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
}
