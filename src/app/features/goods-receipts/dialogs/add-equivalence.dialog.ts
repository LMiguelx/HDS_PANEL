import { Component, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { GoodsReceiptsApi } from '../data-access/goods-receipts.api';
import { BrandProductView, EquivalenceView } from '../domain/goods-receipt.models';

export interface AddEquivalenceDialogData {
  brandId: number;
  products: BrandProductView[];
}

/**
 * Agregar equivalencia — doc 58, sección 8.3. El selector de producto es el
 * mismo de la línea de entrega (7.5): búsqueda en el navegador sobre los
 * productos de la marca, ya cargados.
 */
@Component({
  selector: 'app-add-equivalence-dialog',
  imports: [UiButton, UiField, UiTypeahead, UiModal],
  template: `
    <ui-modal title="Agregar equivalencia" (close)="ref.close(null)">
      <div class="aeq-body">
        <ui-field label="Código del proveedor" placeholder="Opcional" [(value)]="supplierCode" />
        <ui-field
          label="Descripción del proveedor"
          placeholder="Opcional"
          [(value)]="supplierDescription"
        />
        <ui-typeahead
          label="Producto Hispánica"
          placeholder="Elegir producto…"
          [clearOnPick]="false"
          [search]="productSearch"
          [(selected)]="productItem"
        />
        @if (formError()) {
          <div class="aeq-error">{{ formError() }}</div>
        }
        @if (error()) {
          <div class="aeq-error">{{ error() }}</div>
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
      .aeq-body {
        display: grid;
        gap: var(--sp-4);
      }
      .aeq-error {
        color: var(--status-danger, var(--st-mismatch));
        font-size: var(--fs-dense, 13px);
      }
    `,
  ],
})
export class AddEquivalenceDialog {
  protected data = inject<AddEquivalenceDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<EquivalenceView | null>);
  private api = inject(GoodsReceiptsApi);

  protected supplierCode = signal('');
  protected supplierDescription = signal('');
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
    if (!this.submitted()) return '';
    if (!this.productItem()) return 'Elige el producto de Hispánica';
    if (!this.supplierCode().trim() && !this.supplierDescription().trim()) {
      return 'Ingresa al menos el código o la descripción del proveedor';
    }
    return '';
  }

  protected submit() {
    this.submitted.set(true);
    if (this.formError()) return;

    this.saving.set(true);
    this.error.set('');
    this.api
      .createEquivalence(this.data.brandId, {
        supplierCode: this.supplierCode().trim() || null,
        supplierDescription: this.supplierDescription().trim() || null,
        productCode: this.productItem()!.code!,
      })
      .subscribe({
        next: (eq) => {
          this.saving.set(false);
          this.ref.close(eq);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.detail || 'No pudimos agregar la equivalencia.');
        },
      });
  }
}
