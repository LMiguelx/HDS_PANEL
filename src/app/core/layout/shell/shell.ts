import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { UiButton } from '../../../shared/ui/button/button';
import { MaintenanceBlockState } from '../../http/maintenance-block.state';
import { MobileDrawerState } from '../mobile-drawer.state';
import { ShellTopbar } from './shell-topbar';
import { ShellSidebar } from './shell-sidebar';

/**
 * Orquestador del shell: el bloqueo de mantenimiento, la barra superior y el
 * lateral viven en sus propios componentes (ver `shell-topbar.ts` /
 * `shell-sidebar.ts`), separados solo por el presupuesto `anyComponentStyle`
 * (4kB de aviso / 8kB de error, ver ARCHITECTURE_PANEL.md). Este archivo solo
 * arma el layout (`.shell` / `.body` / `.content` / `.scrim`).
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, UiButton, ShellTopbar, ShellSidebar],
  templateUrl: './shell.html',
  styleUrls: ['./shell.scss'],
})
export class ShellComponent {
  private breakpoints = inject(BreakpointObserver);
  readonly maintenanceBlock = inject(MaintenanceBlockState);
  readonly drawer = inject(MobileDrawerState);

  readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  /** Recarga la app entera: el bloqueo no sabe qué pedido falló, así que vuelve a intentar todo desde cero. */
  protected retryAfterMaintenance() {
    window.location.reload();
  }
}
