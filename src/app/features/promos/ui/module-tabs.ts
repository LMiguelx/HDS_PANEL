import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HasPermissionDirective } from '../../../shared/directives/has-permission';

/**
 * Pestañas del módulo (Listado · Premios pendientes · Dotaciones) — el
 * mockup las muestra como tabs a la altura del contenido, no como ítems de
 * menú aparte.
 */
@Component({
  selector: 'app-promo-module-tabs',
  imports: [RouterLink, RouterLinkActive, HasPermissionDirective],
  template: `
    <nav class="promo-tabs">
      <a routerLink="/promociones" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
        >Promociones</a
      >
      <a
        routerLink="/promociones/pendientes"
        routerLinkActive="active"
        *hasPermission="['promo.create', 'promo.approve', 'promo.allocate']"
        >Premios pendientes</a
      >
      <a routerLink="/promociones/dotaciones" routerLinkActive="active" *hasPermission="'promo.allocate'"
        >Dotaciones</a
      >
    </nav>
  `,
  styles: [
    `
      .promo-tabs {
        display: flex;
        gap: 0;
        border-bottom: var(--border-rule);
        overflow: hidden;
        padding: 0 var(--sp-8);
      }
      .promo-tabs a {
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 14px;
        padding: 16px 18px;
        min-height: var(--touch-min);
        display: flex;
        align-items: center;
        color: var(--ink-muted);
        text-decoration: none;
        border-bottom: 3px solid transparent;
      }
      .promo-tabs a:hover {
        color: var(--ink);
      }
      .promo-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class PromoModuleTabs {}
