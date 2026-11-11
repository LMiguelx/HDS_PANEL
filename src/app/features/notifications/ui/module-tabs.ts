import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HasPermissionDirective } from '../../../shared/directives/has-permission';
import { UiButton } from '../../../shared/ui/button/button';

/**
 * Cabecera del módulo Notificaciones: pestañas Del equipo/Envíos (requieren
 * `notification.view_all`) y el botón Nuevo envío (requiere
 * `notification.send`), cada uno oculto por separado — sección 13.4: con
 * solo uno de los dos permisos, el otro elemento simplemente no aparece.
 */
@Component({
  selector: 'app-notification-module-tabs',
  imports: [RouterLink, RouterLinkActive, HasPermissionDirective, UiButton],
  template: `
    <div class="not-head">
      <nav class="not-tabs" *hasPermission="'notification.view_all'">
        <a
          routerLink="/notificaciones"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          >Del equipo</a
        >
        <a routerLink="/notificaciones/envios" routerLinkActive="active">Envíos</a>
      </nav>
      <button
        uiButton
        variant="primary"
        size="sm"
        class="not-new-btn"
        routerLink="/notificaciones/nuevo"
        *hasPermission="'notification.send'"
      >
        Nuevo envío
      </button>
    </div>
  `,
  styles: [
    `
      .not-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      .not-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
      }
      .not-tabs a {
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
      .not-tabs a:hover {
        color: var(--ink);
      }
      .not-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
      .not-new-btn {
        margin: 10px 0;
        flex: none;
      }
      @media (max-width: 767px) {
        .not-head {
          padding: 0 var(--sp-4);
        }
        .not-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
    `,
  ],
})
export class NotificationModuleTabs {}
