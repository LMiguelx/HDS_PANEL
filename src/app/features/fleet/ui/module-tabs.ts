import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas del módulo de Flota, mismo patrón que los demás módulos. */
@Component({
  selector: 'app-fleet-module-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="flt-tabs">
      <a routerLink="/flota" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
        >Vehículos</a
      >
      <a routerLink="/flota/equipos" routerLinkActive="active">Equipos</a>
    </nav>
  `,
  styles: [
    `
      .flt-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      @media (max-width: 767px) {
        .flt-tabs {
          padding: 0 var(--sp-4);
        }
        .flt-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
      .flt-tabs a {
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
      .flt-tabs a:hover {
        color: var(--ink);
      }
      .flt-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class FleetModuleTabs {}
