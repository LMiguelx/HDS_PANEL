import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { PriceAdminService } from '../price-admin';
import { CatalogLookupService } from '../catalog-lookup';
import { PaymentConditionView } from '../../../shared/models/catalog.models';
import { PriceView } from '../../../shared/models/price.models';

export interface PriceFormDialogData {
  productId: number;
  productName: string;
  price?: PriceView; // presente = edición de una fila existente
}

/**
 * Agregar/editar una fila de precio — PUT /api/prices (upsert por clave
 * natural: producto + condición de pago + tipo de cliente + cantidad
 * mínima). No hay catálogo documentado de tipos de cliente — se pide el id
 * como número, igual que el resto del panel trata ids sin nombre resuelto.
 */
@Component({
  selector: 'app-price-form-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="pfd">
      <h2 class="pfd-title">{{ data.price ? 'Editar precio' : 'Agregar precio' }}</h2>
      <p class="pfd-sub">{{ data.productName }}</p>

      <div class="pfd-grid">
        <ui-field
          label="Condición de pago"
          type="select"
          [(value)]="paymentConditionId"
          [options]="paymentConditionOptions()"
          [disabled]="loadingConditions()"
        />
        <ui-field
          label="Tipo de cliente (id)"
          type="number"
          [(value)]="customerTypeId"
          hint="No hay catálogo de tipos de cliente — usa el id que corresponda"
        />
        <ui-field label="Cantidad mínima" type="number" [(value)]="minQuantity" />
        <ui-field label="Precio unitario" type="number" [(value)]="unitPrice" />
      </div>

      @if (error()) {
        <div class="pfd-error">{{ error() }}</div>
      }

      <div class="pfd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Guardar precio
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
        gap: 16px;
        width: 100%;
      }
      .pfd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .pfd-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .pfd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
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
export class PriceFormDialog {
  protected data = inject<PriceFormDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<PriceView | false>);
  private priceSvc = inject(PriceAdminService);
  private lookupSvc = inject(CatalogLookupService);

  protected paymentConditionId = signal(String(this.data.price?.paymentConditionId ?? ''));
  protected customerTypeId = signal(String(this.data.price?.customerTypeId ?? ''));
  protected minQuantity = signal(String(this.data.price?.minQuantity ?? '1'));
  protected unitPrice = signal(String(this.data.price?.unitPrice ?? ''));

  protected paymentConditions = signal<PaymentConditionView[]>([]);
  protected loadingConditions = signal(true);
  protected saving = signal(false);
  protected error = signal('');

  protected paymentConditionOptions(): UiFieldOption[] {
    return [
      { value: '', label: 'Selecciona una condición' },
      ...this.paymentConditions().map((c) => ({
        value: String(c.paymentConditionId),
        label: c.name,
      })),
    ];
  }

  constructor() {
    this.lookupSvc.paymentConditions().subscribe({
      next: (list) => {
        this.paymentConditions.set(list);
        this.loadingConditions.set(false);
      },
      error: () => this.loadingConditions.set(false),
    });
  }

  protected submit() {
    const paymentConditionId = Number(this.paymentConditionId());
    const customerTypeId = Number(this.customerTypeId());
    const minQuantity = Number(this.minQuantity());
    const unitPrice = Number(this.unitPrice());

    if (!paymentConditionId || !customerTypeId || !minQuantity || !unitPrice) {
      this.error.set('Todos los campos son obligatorios y deben ser mayores a 0.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.priceSvc
      .upsert({
        productId: this.data.productId,
        paymentConditionId,
        customerTypeId,
        minQuantity,
        unitPrice,
      })
      .subscribe({
        next: (price) => {
          this.saving.set(false);
          this.ref.close(price);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(
            detalle ? `No pudimos guardar: ${detalle}` : 'No pudimos guardar el precio.',
          );
        },
      });
  }
}
