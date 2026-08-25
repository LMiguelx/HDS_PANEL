import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { UiButton } from '../../../shared/ui/button/button';
import { AuthService } from '../../auth/auth';
import { ThemeService } from '../../theme/theme.service';
import { NAV, NavItem, PROMO_ANY_PERMISSION } from '../nav.config';
import { PendingCountStore } from '../../../features/promos/pending-count';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UiButton],
  templateUrl: './shell.html',
  styleUrls: ['./shell.scss'],
})
export class ShellComponent {
  private auth = inject(AuthService);
  private breakpoints = inject(BreakpointObserver);
  readonly theme = inject(ThemeService);
  readonly pendingCount = inject(PendingCountStore);

  readonly user = this.auth.currentUser;
  readonly drawerOpen = signal(false);

  readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  readonly themeLabel = computed(() => (this.theme.resolved() === 'dark' ? 'Claro' : 'Oscuro'));

  constructor() {
    if (this.auth.hasAny(...PROMO_ANY_PERMISSION)) {
      this.pendingCount.refresh();
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
}
