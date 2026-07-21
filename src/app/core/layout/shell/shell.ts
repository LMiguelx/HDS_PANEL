import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../auth/auth';
import { ThemeService } from '../../theme/theme.service';
import { NAV, NavItem } from '../nav.config';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
  ],
  templateUrl: './shell.html',
  styleUrls: ['./shell.scss'],
})
export class ShellComponent {
  private auth = inject(AuthService);
  private breakpoints = inject(BreakpointObserver);
  readonly theme = inject(ThemeService);

  readonly user = this.auth.currentUser;

  readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

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

  logout() {
    this.auth.logout();
  }
}
