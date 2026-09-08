import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas del módulo de Facturas, mismo patrón que los demás módulos. */
@Component({
  selector: 'app-invoice-module-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="inv-tabs">
      <a
        routerLink="/facturas"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        >Sin conciliar</a
      >
      <a routerLink="/facturas/por-cliente" routerLinkActive="active">Por cliente</a>
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
export class InvoiceModuleTabs {}
