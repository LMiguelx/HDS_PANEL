import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de Validación de pedidos (doc 32) — distinto del módulo de Facturas/conciliación. */
@Component({
  selector: 'app-billing-validation-module-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="bvt-tabs">
      <a
        routerLink="/validacion-facturacion"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        >Por enviar</a
      >
      <a routerLink="/validacion-facturacion/enviados" routerLinkActive="active">Enviados</a>
    </nav>
  `,
  styles: [
    `
      .bvt-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      @media (max-width: 767px) {
        .bvt-tabs {
          padding: 0 var(--sp-4);
        }
        .bvt-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
      .bvt-tabs a {
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
      .bvt-tabs a:hover {
        color: var(--ink);
      }
      .bvt-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class BillingValidationModuleTabs {}
