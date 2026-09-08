import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { NAV, NavItem } from '../../core/layout/nav.config';
import { HasPermissionDirective } from '../../shared/directives/has-permission';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, HasPermissionDirective],
  template: `
    <section class="home-page">
      <h1>Bienvenido{{ user()?.fullName ? ', ' + user()?.fullName : '' }}</h1>
      <p class="home-sub">
        Panel de control. Por ahora solo Promociones está rediseñado; el resto de módulos llega
        después.
      </p>

      <div class="home-section-label">Disponible</div>
      <div class="home-grid">
        <a class="home-tile is-ready" routerLink="/promociones" *hasPermission="promoPermissions">
          <span class="home-tile-name">Promociones</span>
          <span class="home-tile-note"
            >Campañas, premios pendientes y dotaciones a vendedores.</span
          >
        </a>
        <a class="home-tile is-ready" routerLink="/asignaciones" *hasPermission="'customer.assign'">
          <span class="home-tile-name">Asignaciones</span>
          <span class="home-tile-note">Cartera por vendedor, ausencias del día y cobertura.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/clientes" *hasPermission="'customer.view'">
          <span class="home-tile-name">Clientes</span>
          <span class="home-tile-note">Buscador y ficha con métricas de compra.</span>
        </a>
        <a
          class="home-tile is-ready"
          routerLink="/aprobaciones"
          *hasPermission="'customer.approve'"
        >
          <span class="home-tile-name">Aprobaciones</span>
          <span class="home-tile-note">Solicitudes de creación, cambio de campo y cierre.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/mantenimiento" *hasPermission="'config.edit'">
          <span class="home-tile-name">Mantenimiento</span>
          <span class="home-tile-note">Activa o desactiva el modo mantenimiento del sistema.</span>
        </a>
        <a
          class="home-tile is-ready"
          routerLink="/reparto"
          *hasPermission="['delivery.deliver', 'delivery.settle']"
        >
          <span class="home-tile-name">Reparto</span>
          <span class="home-tile-note">Planillas, mapa de entregas y devoluciones.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/flota" *hasPermission="'delivery.settle'">
          <span class="home-tile-name">Flota</span>
          <span class="home-tile-note">Vehículos y equipos de reparto.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/facturas" *hasPermission="'invoice.reconcile'">
          <span class="home-tile-name">Facturas</span>
          <span class="home-tile-note">Conciliación con pedidos y bandeja sin conciliar.</span>
        </a>
      </div>

      <div class="home-section-label">Próximamente</div>
      <div class="home-grid">
        @for (item of pendingModules(); track item.route) {
          <a class="home-tile" [routerLink]="item.route">
            <span class="home-tile-name">{{ item.label }}</span>
            <span class="home-tile-note">Se rediseñará próximamente.</span>
          </a>
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        font-family: var(--font-sans);
        color: var(--ink);
      }
      .home-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
      }
      .home-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
        max-width: 620px;
      }
      .home-section-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        border-bottom: var(--border-rule);
        padding-bottom: 8px;
        margin: 28px 0 14px;
      }
      .home-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
        gap: 12px;
      }
      .home-tile {
        display: flex;
        flex-direction: column;
        gap: 4px;
        border: 1px solid var(--hairline);
        padding: 16px 18px;
        min-height: var(--touch-min);
        text-decoration: none;
        color: var(--ink-muted);
        opacity: 0.6;
        transition: border-color var(--dur-fast) var(--ease-standard);
      }
      .home-tile:hover {
        border-color: var(--ink-muted);
      }
      .home-tile:focus-visible {
        outline: var(--border-focus);
        outline-offset: 2px;
      }
      .home-tile.is-ready {
        border: 2px solid var(--divider);
        color: var(--ink);
        opacity: 1;
      }
      .home-tile.is-ready:hover {
        border-color: var(--accent);
      }
      .home-tile-name {
        font-weight: 800;
        font-size: 16px;
      }
      .home-tile-note {
        font-size: 13px;
        line-height: 1.45;
      }

      @media (max-width: 767px) {
        .home-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class DashboardPage {
  private auth = inject(AuthService);
  readonly user = this.auth.currentUser;

  readonly promoPermissions = ['promo.create', 'promo.approve', 'promo.allocate'];

  /** Los módulos apagados que este usuario sí puede ver en el menú. */
  pendingModules(): NavItem[] {
    return NAV.filter((i) => i.comingSoon && this.auth.hasAny(...i.anyOf));
  }
}
