import { Component, computed, inject } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import {
  PickingDetail,
  PickingProductConsolidatedView,
} from '../../../shared/models/picking.models';
import { quantityText } from '../../sales-reports/sales-report-format';

export interface PickingCloseDialogData {
  detail: PickingDetail;
}

/**
 * Confirmación de "Cerrar picking" — doc 89, sección 5.3: resumen de
 * completos/faltantes/no cargados, lista corta de los que faltaron y
 * aviso de que no hay vuelta atrás.
 */
@Component({
  selector: 'app-picking-close-dialog',
  imports: [UiButton],
  template: `
    <div class="pcd">
      <h2 class="pcd-title">Cerrar picking</h2>
      <p class="pcd-sub">
        Vas a cerrar el picking de la planilla {{ data.detail.series }}-{{ data.detail.number }}.
      </p>

      <div class="pcd-counts">
        <span
          >Completos: <strong>{{ data.detail.pickingCounts.complete }}</strong></span
        >
        <span
          >Faltantes: <strong>{{ data.detail.pickingCounts.shortLoaded }}</strong></span
        >
        <span
          >No cargados: <strong>{{ data.detail.pickingCounts.notLoaded }}</strong></span
        >
      </div>

      @if (shortfallProducts().length > 0) {
        <ul class="pcd-list">
          @for (p of shortfallProducts(); track p.productId) {
            <li>
              <strong>{{ p.productName }}</strong> — cargado {{ quantityText(p.loadedQuantity) }} de
              {{ quantityText(p.totalQuantity) }}
              @if (p.shortNote) {
                <span class="pcd-note">· {{ p.shortNote }}</span>
              }
            </li>
          }
        </ul>
      }

      <p class="pcd-warning">Una vez cerrado, el picking no se puede editar ni reabrir.</p>

      <div class="pcd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" (click)="ref.close(true)">Cerrar picking</button>
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .pcd {
        display: grid;
        gap: 14px;
      }
      .pcd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .pcd-sub {
        margin: 0;
        font-size: 14px;
        color: var(--ink-muted);
      }
      .pcd-counts {
        display: flex;
        gap: 18px;
        font-size: 13px;
        color: var(--ink);
      }
      .pcd-list {
        margin: 0;
        padding: 0 0 0 18px;
        max-height: 200px;
        overflow: auto;
        font-size: 13px;
        color: var(--ink);
        display: grid;
        gap: 6px;
      }
      .pcd-note {
        color: var(--ink-muted);
      }
      .pcd-warning {
        margin: 0;
        padding: 10px 12px;
        font-size: 13px;
        font-weight: 700;
        color: var(--status-warn);
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
      }
      .pcd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class PickingCloseDialog {
  protected data = inject<PickingCloseDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);

  protected quantityText = quantityText;

  protected shortfallProducts = computed<PickingProductConsolidatedView[]>(() =>
    this.data.detail.consolidatedByProduct.filter(
      (p) => p.pickingStatus === 'SHORT' || p.pickingStatus === 'NOT_LOADED',
    ),
  );
}
