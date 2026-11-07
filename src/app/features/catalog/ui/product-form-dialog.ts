import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiToggle } from '../../../shared/ui/toggle/toggle';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { ProductAdminService } from '../product-admin';
import { CatalogLookupService } from '../catalog-lookup';
import { FamilyView, ProductView } from '../../../shared/models/catalog.models';

export interface ProductFormDialogData {
  product?: ProductView; // presente = edición; ausente = alta
}

export interface ProductFormResult {
  productId: number;
  code: string;
}

/** Alta/edición de producto — POST o PATCH /api/catalog/products. `product.edit`. */
@Component({
  selector: 'app-product-form-dialog',
  imports: [UiButton, UiField, UiToggle],
  template: `
    <div class="pfd">
      <h2 class="pfd-title">{{ isEdit ? 'Editar producto' : 'Nuevo producto' }}</h2>

      <div class="pfd-grid">
        <ui-field
          label="Código"
          [(value)]="code"
          [disabled]="isEdit"
          hint="Máx. 10 — no se puede cambiar después del alta"
        />
        <ui-field label="Nombre" [(value)]="name" />
        <ui-field
          label="Familia"
          type="select"
          [(value)]="familyId"
          [options]="familyOptions()"
          [disabled]="loadingFamilies()"
        />
        <ui-field label="Código de barras" [(value)]="barcode" />
        <ui-field label="Unidad de medida" [(value)]="unitOfMeasure" hint="Máx. 10, p.ej. CAJA" />
        <ui-field label="Unidades por bulto" type="number" [(value)]="unitsPerPackage" />
        <ui-field label="Peso (kg)" type="number" [(value)]="weightKg" />
      </div>

      <ui-toggle label="Elegible para bonificación" [(checked)]="isBonusEligible" />

      @if (error()) {
        <div class="pfd-error">{{ error() }}</div>
      }

      <div class="pfd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          {{ isEdit ? 'Guardar cambios' : 'Crear producto' }}
        </button>
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .pfd {
        display: grid;
        gap: 18px;
        width: 100%;
      }
      .pfd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .pfd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
        gap: 14px;
      }
      .pfd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .pfd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class ProductFormDialog {
  protected data = inject<ProductFormDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<ProductFormResult | false>);
  private productSvc = inject(ProductAdminService);
  private lookupSvc = inject(CatalogLookupService);

  protected isEdit = !!this.data.product;

  protected code = signal(this.data.product?.code ?? '');
  protected name = signal(this.data.product?.name ?? '');
  protected familyId = signal(String(this.data.product?.familyId ?? ''));
  protected barcode = signal(this.data.product?.barcode ?? '');
  protected unitOfMeasure = signal(this.data.product?.unitOfMeasure ?? '');
  protected unitsPerPackage = signal(String(this.data.product?.unitsPerPackage ?? ''));
  protected weightKg = signal(String(this.data.product?.weightKg ?? ''));
  protected isBonusEligible = signal(this.data.product?.isBonusEligible ?? false);

  protected families = signal<FamilyView[]>([]);
  protected loadingFamilies = signal(true);
  protected saving = signal(false);
  protected error = signal('');

  protected familyOptions(): UiFieldOption[] {
    return [
      { value: '', label: 'Selecciona una familia' },
      ...this.families().map((f) => ({
        value: String(f.familyId),
        label: `${f.brandName} — ${f.name}`,
      })),
    ];
  }

  constructor() {
    this.lookupSvc.families().subscribe({
      next: (list) => {
        this.families.set(list);
        this.loadingFamilies.set(false);
      },
      error: () => this.loadingFamilies.set(false),
    });
  }

  protected submit() {
    const familyId = Number(this.familyId());
    if (!this.code().trim() || !this.name().trim() || !familyId) {
      this.error.set('Código, nombre y familia son obligatorios.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const base = {
      name: this.name().trim(),
      familyId,
      barcode: this.barcode().trim() || undefined,
      unitOfMeasure: this.unitOfMeasure().trim() || undefined,
      unitsPerPackage: this.unitsPerPackage() ? Number(this.unitsPerPackage()) : undefined,
      weightKg: this.weightKg() ? Number(this.weightKg()) : undefined,
      isBonusEligible: this.isBonusEligible(),
    };

    if (this.isEdit) {
      const productId = this.data.product!.productId;
      this.productSvc.update(productId, base).subscribe({
        next: () => {
          this.saving.set(false);
          this.ref.close({ productId, code: this.data.product!.code });
        },
        error: (err) => this.handleError(err),
      });
    } else {
      this.productSvc.create({ ...base, code: this.code().trim() }).subscribe({
        next: (result) => {
          this.saving.set(false);
          this.ref.close(result);
        },
        error: (err) => this.handleError(err),
      });
    }
  }

  private handleError(err: unknown) {
    this.saving.set(false);
    const detalle =
      (err as { error?: { detail?: string; message?: string } })?.error?.detail ??
      (err as { error?: { detail?: string; message?: string } })?.error?.message;
    this.error.set(detalle ? `No pudimos guardar: ${detalle}` : 'No pudimos guardar el producto.');
  }
}
