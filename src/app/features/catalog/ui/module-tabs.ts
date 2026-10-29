import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HasPermissionDirective } from '../../../shared/directives/has-permission';

/** Pestañas del módulo de Catálogo y precios, mismo patrón que los demás módulos. */
@Component({
  selector: 'app-catalog-module-tabs',
  imports: [RouterLink, RouterLinkActive, HasPermissionDirective],
  template: `
    <nav class="cat-tabs">
      <a routerLink="/precios" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
        >Productos</a
      >
      <a routerLink="/precios/sin-precio" routerLinkActive="active" *hasPermission="'product.edit'"
        >Sin precio</a
      >
    </nav>
  `,
  styles: [
    `
      .cat-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      @media (max-width: 767px) {
        .cat-tabs {
          padding: 0 var(--sp-4);
        }
        .cat-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
      .cat-tabs a {
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
      .cat-tabs a:hover {
        color: var(--ink);
      }
      .cat-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class CatalogModuleTabs {}
