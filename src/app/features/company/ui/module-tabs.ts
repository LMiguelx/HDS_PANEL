import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HasPermissionDirective } from '../../../shared/directives/has-permission';

/** Pestañas del módulo de Empresa, mismo patrón que los demás módulos. */
@Component({
  selector: 'app-company-module-tabs',
  imports: [RouterLink, RouterLinkActive, HasPermissionDirective],
  template: `
    <nav class="cmp-tabs">
      <a routerLink="/empresa/sedes" routerLinkActive="active">Sedes</a>
      <a routerLink="/empresa/configuracion" routerLinkActive="active">Configuración</a>
      <a
        routerLink="/empresa/sistema"
        routerLinkActive="active"
        *hasPermission="'system.maintenance.manage'"
        >Sistema</a
      >
    </nav>
  `,
  styles: [
    `
      .cmp-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      @media (max-width: 767px) {
        .cmp-tabs {
          padding: 0 var(--sp-4);
        }
        .cmp-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
      .cmp-tabs a {
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
      .cmp-tabs a:hover {
        color: var(--ink);
      }
      .cmp-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class CompanyModuleTabs {}
