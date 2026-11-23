import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HasPermissionDirective } from '../../../shared/directives/has-permission';
import { PERMISSIONS } from '../../../core/auth/permissions';

/**
 * Pestañas del módulo — doc 58, sección 1. Solo envuelve los dos listados
 * (Entregas y Configuración por marca): el detalle de una entrega y la
 * página de una marca son pantallas propias, sin esta barra (como ya hace
 * Inventario con Cuadre con el ERP, doc 56). Ruta layout en vez de un
 * `module-tabs.ts` propio — ARCHITECTURE_PANEL.md, sección 5.3.
 */
@Component({
  selector: 'app-goods-receipts-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, HasPermissionDirective],
  template: `
    <nav class="grl-tabs">
      <a routerLink="/recepcion-mercaderia/entregas" routerLinkActive="active">Entregas</a>
      <a
        routerLink="/recepcion-mercaderia/configuracion"
        routerLinkActive="active"
        *hasPermission="[permissions.GOODS_RECEIPT_CONFIG, permissions.GOODS_RECEIPT_VIEW]"
        >Configuración por marca</a
      >
    </nav>
    <router-outlet />
  `,
  styles: [
    `
      .grl-tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        border-bottom: var(--border-rule);
        padding: 0 var(--sp-8);
      }
      @media (max-width: 767px) {
        .grl-tabs {
          padding: 0 var(--sp-4);
        }
        .grl-tabs a {
          padding: 16px 12px;
          font-size: 13px;
        }
      }
      .grl-tabs a {
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
      .grl-tabs a:hover {
        color: var(--ink);
      }
      .grl-tabs a.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class GoodsReceiptsLayout {
  protected permissions = PERMISSIONS;
}
