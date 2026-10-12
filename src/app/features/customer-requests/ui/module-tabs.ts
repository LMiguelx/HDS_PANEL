import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas del módulo de Solicitudes de cliente, mismo patrón que los demás módulos. */
@Component({
  selector: 'app-request-module-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="req-tabs">
      <a
        routerLink="/aprobaciones"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        >Creación</a
      >
      <a routerLink="/aprobaciones/cambios" routerLinkActive="active">Cambio de campo</a>
      <a routerLink="/aprobaciones/cierre" routerLinkActive="active">Cierre</a>
    </nav>
  `,
  styles: [
    `
      .req-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      @media (max-width: 767px) {
        .req-tabs {
          padding: 0 var(--sp-4);
        }
        .req-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
      .req-tabs a {
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
      .req-tabs a:hover {
        color: var(--ink);
      }
      .req-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class RequestModuleTabs {}
