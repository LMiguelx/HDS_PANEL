import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HasPermissionDirective } from '../../../shared/directives/has-permission';

/** Pestañas del módulo de Inventario, mismo patrón que los demás módulos. */
@Component({
  selector: 'app-inventory-module-tabs',
  imports: [RouterLink, RouterLinkActive, HasPermissionDirective],
  template: `
    <nav class="inv-tabs">
      <a
        routerLink="/inventario"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        >Stock por almacén</a
      >
      <a routerLink="/inventario/ajuste" routerLinkActive="active" *hasPermission="'config.edit'"
        >Ajuste de stock</a
      >
    </nav>
  `,
  styles: [
    `
      .inv-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      @media (max-width: 767px) {
        .inv-tabs {
          padding: 0 var(--sp-4);
        }
        .inv-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
      .inv-tabs a {
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
      .inv-tabs a:hover {
        color: var(--ink);
      }
      .inv-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class InventoryModuleTabs {}
