import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HasPermissionDirective } from '../../../shared/directives/has-permission';

/** Pestañas del módulo de Pedidos, mismo patrón que los demás módulos. */
@Component({
  selector: 'app-order-module-tabs',
  imports: [RouterLink, RouterLinkActive, HasPermissionDirective],
  template: `
    <nav class="ord-tabs">
      <a routerLink="/pedidos" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
        >Listado</a
      >
      <a
        routerLink="/pedidos/bonificaciones-pendientes"
        routerLinkActive="active"
        *hasPermission="'order.view_all'"
        >Bonificaciones pendientes</a
      >
    </nav>
  `,
  styles: [
    `
      .ord-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      @media (max-width: 767px) {
        .ord-tabs {
          padding: 0 var(--sp-4);
        }
        .ord-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
      .ord-tabs a {
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 14px;
        padding: 16px 18px;
        min-height: var(--touch-min);
        display: flex;
        align-items: center;
        white-space: nowrap;
        color: var(--ink-muted);
        text-decoration: none;
        border-bottom: 3px solid transparent;
      }
      .ord-tabs a:hover {
        color: var(--ink);
      }
      .ord-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class OrderModuleTabs {}
