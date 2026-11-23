import { Component, computed, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { GoodsReceiptsApi } from '../data-access/goods-receipts.api';
import { SeriesView } from '../domain/goods-receipt.models';
import { DOCUMENT_TYPE_OPTIONS } from '../domain/goods-receipt.format';

const SERIES_DOC_TYPE_OPTIONS: UiFieldOption[] = DOCUMENT_TYPE_OPTIONS.filter((o) => o.value);

export interface SeriesDialogData {
  brandId: number;
  /** Corregir solo trae `series`: el tipo de documento no se puede cambiar una vez registrada. */
  mode: 'add' | 'change';
  series?: SeriesView;
}

/**
 * Agregar / Corregir serie — doc 72, sección 2.4. Mismo diálogo para los
 * dos casos: en "Corregir" el tipo de documento es de solo lectura.
 */
@Component({
  selector: 'app-series-dialog',
  imports: [UiButton, UiField, UiModal],
  template: `
    <ui-modal
      [title]="data.mode === 'add' ? 'Agregar serie' : 'Corregir serie'"
      (close)="ref.close(null)"
    >
      <div class="sd-body">
        @if (data.mode === 'add') {
          <ui-field
            label="Tipo de documento"
            type="select"
            [value]="documentTypeCode()"
            (valueChange)="documentTypeCode.set($event)"
            [options]="docTypeOptions"
          />
        } @else {
          <div class="sd-field">
            <label>Tipo de documento</label>
            <div class="sd-readonly">{{ data.series!.documentTypeName }}</div>
          </div>
        }

        <div class="sd-field">
          <ui-field
            label="Serie"
            placeholder="FO01"
            [value]="series()"
            (valueChange)="onSeriesChange($event)"
            [error]="seriesError()"
          />
          <p class="sd-hint">
            Los 4 caracteres antes del guion. Respete letras y números tal como están impresos: FO01
            lleva la letra O; F001 lleva ceros.
          </p>
        </div>

        @if (apiError()) {
          <div class="sd-error">{{ apiError() }}</div>
        }
      </div>

      <ng-container modalFooter>
        <button uiButton variant="secondary" (click)="ref.close(null)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">Guardar</button>
      </ng-container>
    </ui-modal>
  `,
  styles: [
    `
      .sd-body {
        display: grid;
        gap: var(--sp-4);
      }
      .sd-field {
        display: grid;
        gap: 4px;
      }
      .sd-field label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .sd-readonly {
        min-height: var(--touch-min);
        padding: 0 12px;
        display: flex;
        align-items: center;
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        color: var(--ink-muted);
        font-size: 15px;
      }
      .sd-hint {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .sd-error {
        color: var(--status-danger, var(--st-mismatch));
        font-size: var(--fs-dense, 13px);
      }
    `,
  ],
})
export class SeriesDialog {
  protected data = inject<SeriesDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<SeriesView | null>);
  private api = inject(GoodsReceiptsApi);

  protected docTypeOptions = SERIES_DOC_TYPE_OPTIONS;

  protected documentTypeCode = signal(
    this.data.mode === 'change' ? this.data.series!.documentTypeCode : 'INVOICE',
  );
  protected series = signal(this.data.mode === 'change' ? this.data.series!.series : '');
  protected saving = signal(false);
  protected submitted = signal(false);
  protected apiError = signal('');

  protected onSeriesChange(v: string) {
    this.series.set(v.toUpperCase().slice(0, 4));
    this.apiError.set('');
  }

  protected seriesError = computed(() => {
    if (!this.submitted()) return '';
    const v = this.series().trim();
    return v.length === 4 ? '' : 'La serie debe tener 4 letras o números';
  });

  protected submit() {
    this.submitted.set(true);
    if (this.seriesError()) return;

    this.saving.set(true);
    this.apiError.set('');
    const req =
      this.data.mode === 'add'
        ? this.api.createSeries(this.data.brandId, {
            documentTypeCode: this.documentTypeCode(),
            series: this.series().trim(),
          })
        : this.api.changeSeries(this.data.series!.seriesId, { series: this.series().trim() });

    req.subscribe({
      next: (s) => {
        this.saving.set(false);
        this.ref.close(s);
      },
      error: (err) => {
        this.saving.set(false);
        this.apiError.set(err?.error?.detail || 'No pudimos guardar la serie.');
      },
    });
  }
}
