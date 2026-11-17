import { Component, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { UiButton } from '../../../shared/ui/button/button';
import { UiTypeahead, UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { GoodsReceiptsApi } from '../data-access/goods-receipts.api';
import { BrandProductView, EquivalenceView } from '../domain/goods-receipt.models';

export interface ChangeEquivalenceDialogData {
  equivalence: EquivalenceView;
  products: BrandProductView[];
}

/**
 * Cambiar el producto de una equivalencia — doc 58, sección 8.3. Nunca se
 * edita el código/descripción del proveedor: solo a qué producto apunta.
 */
@Component({
  selector: 'app-change-equivalence-dialog',
  imports: [UiButton, UiTypeahead, UiModal],
  template: `
    <ui-modal
      title="Cambiar producto"
      [subtitle]="data.equivalence.supplierCode || data.equivalence.supplierDescription || ''"
      (close)="ref.close(null)"
    >
      <div class="ceq-body">
        <p class="ceq-current">
          Producto actual:
          <strong>{{ data.equivalence.productCode }} {{ data.equivalence.productName }}</strong>
        </p>
        <ui-typeahead
          label="Nuevo producto Hispánica"
          placeholder="Elegir producto…"
          [clearOnPick]="false"
          [search]="productSearch"
          [(selected)]="productItem"
        />
        @if (formError()) {
          <div class="ceq-error">{{ formError() }}</div>
        }
        @if (error()) {
          <div class="ceq-error">{{ error() }}</div>
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
      .ceq-body {
        display: grid;
        gap: var(--sp-4);
      }
      .ceq-current {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ceq-error {
        color: var(--status-danger, var(--st-mismatch));
        font-size: var(--fs-dense, 13px);
      }
    `,
  ],
})
export class ChangeEquivalenceDialog {
  protected data = inject<ChangeEquivalenceDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<EquivalenceView | null>);
  private api = inject(GoodsReceiptsApi);

  protected productItem = signal<UiLookupItem | null>(null);
  protected saving = signal(false);
  protected submitted = signal(false);
  protected error = signal('');

  private productLookup = computed<UiLookupItem[]>(() =>
    this.data.products.map((p, i) => ({
      id: i,
      code: p.productCode,
      name: p.productName,
      extraInfo: [p.unitOfMeasure, p.bonusEligible ? 'Bonificación' : null]
        .filter(Boolean)
        .join(' · '),
    })),
  );

  protected productSearch = (q: string): Observable<UiLookupItem[]> => {
    const needle = q.trim().toLowerCase();
    if (!needle) return of(this.productLookup().slice(0, 30));
    return of(
      this.productLookup().filter(
        (p) => p.code?.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle),
      ),
    );
  };

  protected formError(): string {
    return this.submitted() && !this.productItem() ? 'Elige el nuevo producto' : '';
  }

  protected submit() {
    this.submitted.set(true);
    if (this.formError()) return;

    this.saving.set(true);
    this.error.set('');
    this.api
      .changeEquivalenceProduct(this.data.equivalence.equivalenceId, {
        productCode: this.productItem()!.code!,
      })
      .subscribe({
        next: (eq) => {
          this.saving.set(false);
          this.ref.close(eq);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.detail || 'No pudimos cambiar el producto.');
        },
      });
  }
}
