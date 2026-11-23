import { Component, computed, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { InventoryAdminService } from '../inventory-admin';
import { advanceWarningIcon, advanceWarningToneVar } from '../inventory-format';
import {
  StockAdvanceLine,
  StockAdvancePreviewResult,
} from '../../../shared/models/inventory.models';

interface ReviewDraftLine {
  productCode: string;
  productName: string;
  warehouseId: number;
  quantity: number;
}

export interface ReviewAdvancesDialogData {
  lines: ReviewDraftLine[]; // lo que el usuario armó — mismo orden con el que se llamó a /preview
  preview: StockAdvancePreviewResult; // primera revisión, ya hecha por el padre
}

interface ReviewRow extends ReviewDraftLine {
  valid: boolean;
  pendingBefore: number | null;
  errorReason: string | null;
  warnings: StockAdvancePreviewResult['lines'][number]['warnings'];
  removed: boolean;
}

function zip(lines: ReviewDraftLine[], preview: StockAdvancePreviewResult): ReviewRow[] {
  return lines.map((line, i) => {
    const p = preview.lines.find((l) => l.lineIndex === i);
    return {
      ...line,
      valid: p?.valid ?? true,
      pendingBefore: p?.pendingBefore ?? null,
      errorReason: p?.errorReason ?? null,
      warnings: p?.warnings ?? [],
      removed: false,
    };
  });
}

/**
 * "Revisar antes de adelantar" — doc 69, sección 5.2. Se abre cuando la
 * revisión (`/preview`) trae avisos o filas inválidas. Nunca crea nada por
 * sí sola: cierra con la lista final de líneas que el padre debe enviar a
 * `POST /stock-advances`, o con `null` si se vuelve sin adelantar.
 */
@Component({
  selector: 'app-review-advances-dialog',
  imports: [UiButton, UiModal],
  template: `
    <ui-modal title="Revisar antes de adelantar" [subtitle]="subtitle()" (close)="ref.close(null)">
      <div class="rad">
        @if (withWarnings().length > 0) {
          <div class="rad-group">
            @for (row of withWarnings(); track row.productCode) {
              <div class="rad-row">
                <div class="rad-row-head">
                  <span class="rad-row-name"
                    >{{ row.productName }} · {{ row.productCode }} · Adelantar
                    {{ row.quantity }}</span
                  >
                  <button type="button" class="rad-remove" (click)="remove(row)">Quitar</button>
                </div>
                @for (w of row.warnings; track w.code) {
                  <div class="rad-warning" [style.border-left-color]="'var(' + tone(w.code) + ')'">
                    <span [style.color]="'var(' + tone(w.code) + ')'">{{ icon(w.code) }}</span>
                    {{ w.message }}
                  </div>
                }
                @if (row.pendingBefore && row.pendingBefore > 0) {
                  <div class="rad-pending">
                    Ya tiene {{ row.pendingBefore }} adelantado sin cubrir
                  </div>
                }
              </div>
            }
          </div>
        }

        @if (invalid().length > 0) {
          <div class="rad-invalid-block">
            <div class="rad-invalid-title">
              {{ invalid().length }} producto{{ invalid().length === 1 ? '' : 's' }} no se
              {{ invalid().length === 1 ? 'puede' : 'pueden' }} adelantar
            </div>
            @for (row of invalid(); track row.productCode) {
              <div class="rad-invalid-row">
                <span class="rad-cell-strong">{{ row.productCode }}</span>
                <span>{{ row.errorReason }}</span>
              </div>
            }
          </div>
        }

        @if (clean().length > 0) {
          <p class="rad-clean">{{ clean().length }} productos sin avisos</p>
        }

        @if (reviewError()) {
          <div class="rad-error">{{ reviewError() }}</div>
        }
      </div>

      <ng-container modalFooter>
        @if (allWarningsPending()) {
          <button uiButton variant="ghost" [loading]="reviewing()" (click)="reviewAgain()">
            Revisar de nuevo
          </button>
        }
        <button uiButton variant="secondary" (click)="ref.close(null)">Volver</button>
        <button
          uiButton
          variant="primary"
          [disabled]="remaining().length === 0"
          (click)="confirm()"
        >
          Adelantar igual {{ remaining().length }} producto{{ remaining().length === 1 ? '' : 's' }}
        </button>
      </ng-container>
    </ui-modal>
  `,
  styles: [
    `
      .rad {
        display: grid;
        gap: 16px;
      }
      .rad-group {
        display: grid;
        gap: 14px;
      }
      .rad-row {
        border: 1px solid var(--hairline);
        padding: 12px 14px;
        display: grid;
        gap: 6px;
      }
      .rad-row-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .rad-row-name {
        font-weight: 800;
        font-size: 13px;
        color: var(--ink);
      }
      .rad-remove {
        flex: none;
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 700;
        color: var(--accent-ink);
        padding: 0;
      }
      .rad-warning {
        border-left: 3px solid var(--status-warn);
        padding: 4px 0 4px 10px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .rad-pending {
        font-size: 12px;
        font-weight: 700;
        color: var(--ink-muted);
      }
      .rad-invalid-block {
        border: 1px solid var(--status-danger);
        background: color-mix(in srgb, var(--status-danger) 6%, transparent);
        padding: 12px 14px;
        display: grid;
        gap: 6px;
      }
      .rad-invalid-title {
        font-weight: 800;
        font-size: 13px;
        color: var(--status-danger);
      }
      .rad-invalid-row {
        display: flex;
        gap: 10px;
        font-size: 12px;
        color: var(--ink);
      }
      .rad-cell-strong {
        font-weight: 700;
        color: var(--status-danger);
      }
      .rad-clean {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .rad-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
    `,
  ],
})
export class ReviewAdvancesDialog {
  protected data = inject<ReviewAdvancesDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<StockAdvanceLine[] | null>);
  private inventorySvc = inject(InventoryAdminService);

  protected icon = advanceWarningIcon;
  protected tone = advanceWarningToneVar;

  protected rows = signal<ReviewRow[]>(zip(this.data.lines, this.data.preview));
  protected reviewing = signal(false);
  protected reviewError = signal('');

  protected subtitle = computed(
    () =>
      `${this.withWarnings().length + this.rows().filter((r) => !r.valid).length} de ${this.rows().length} productos tienen avisos del ERP. Un adelanto de algo que el ERP ya registró queda de más y nunca se cubre.`,
  );

  protected withWarnings = computed(() =>
    this.rows().filter((r) => r.valid && !r.removed && r.warnings.length > 0),
  );
  protected invalid = computed(() => this.rows().filter((r) => !r.valid));
  protected clean = computed(() =>
    this.rows().filter((r) => r.valid && !r.removed && r.warnings.length === 0),
  );
  protected remaining = computed(() => this.rows().filter((r) => r.valid && !r.removed));

  protected allWarningsPending = computed(() => {
    const withW = this.withWarnings();
    if (withW.length === 0) return false;
    return withW.every((r) => r.warnings.every((w) => w.code === 'ERP_UPLOAD_PENDING'));
  });

  protected remove(row: ReviewRow) {
    this.rows.update((rows) =>
      rows.map((r) => (r.productCode === row.productCode ? { ...r, removed: true } : r)),
    );
  }

  protected reviewAgain() {
    this.reviewing.set(true);
    this.reviewError.set('');
    this.inventorySvc
      .previewStockAdvances({
        lines: this.data.lines.map((l) => ({
          productCode: l.productCode,
          warehouseId: l.warehouseId,
          quantity: l.quantity,
        })),
      })
      .subscribe({
        next: (preview) => {
          this.reviewing.set(false);
          this.rows.set(zip(this.data.lines, preview));
        },
        error: () => {
          this.reviewing.set(false);
          this.reviewError.set('No se pudo revisar el adelanto. Inténtalo de nuevo.');
        },
      });
  }

  protected confirm() {
    const lines: StockAdvanceLine[] = this.remaining().map((r) => ({
      productCode: r.productCode,
      warehouseId: r.warehouseId,
      quantity: r.quantity,
    }));
    this.ref.close(lines);
  }
}
