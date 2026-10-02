import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de Reportes de ventas, mismo patrón que los demás módulos. */
@Component({
  selector: 'app-sales-report-module-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="srt-tabs">
      <a routerLink="/reportes-ventas/resumen-dia" routerLinkActive="active">Resumen del día</a>
      <a routerLink="/reportes-ventas/liquidacion-vendedores" routerLinkActive="active"
        >Liquidación de vendedores</a
      >
      <a routerLink="/reportes-ventas/marcas-productos" routerLinkActive="active"
        >Marcas y productos</a
      >
      <a routerLink="/reportes-ventas/ventas-con-stock" routerLinkActive="active"
        >Ventas con stock</a
      >
    </nav>
  `,
  styles: [
    `
      .srt-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      @media (max-width: 767px) {
        .srt-tabs {
          padding: 0 var(--sp-4);
        }
        .srt-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
      .srt-tabs a {
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
      .srt-tabs a:hover {
        color: var(--ink);
      }
      .srt-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class SalesReportModuleTabs {}
