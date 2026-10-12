import { Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { PriceAdminService } from '../price-admin';
import { CatalogLookupService } from '../catalog-lookup';
import { PaymentConditionView, CustomerTypeView } from '../../../shared/models/catalog.models';
import { PriceView } from '../../../shared/models/price.models';

export interface PriceFormDialogData {
  productId: number;
  productName: string;
  price?: PriceView; // presente = edición de una fila existente
}

/**
 * Agregar/editar una fila de precio — PUT /api/prices (upsert por clave
 * natural: producto + condición de pago + tipo de cliente + cantidad
 * mínima). Al editar, cambiar cualquiera de esos tres campos crearía otra
 * fila en vez de modificar la existente, así que quedan bloqueados — doc
 * 38, sección 4.3/7.5. El tipo de cliente ya tiene catálogo propio (antes
 * se pedía el id a mano — V2).
 */
@Component({
  selector: 'app-price-form-dialog',
  imports: [UiButton, UiField, UiModal],
  template: `
    <ui-modal
      [title]="data.price ? 'Editar precio' : 'Agregar precio'"
      [subtitle]="data.productName"
      (close)="ref.close(false)"
    >
      <div class="pfd-grid">
        <ui-field
          label="Condición de pago"
          type="select"
          [(value)]="paymentConditionId"
          [options]="paymentConditionOptions()"
          [disabled]="loadingCatalogs() || isEditing"
        />
        <ui-field
          label="Tipo de cliente"
          type="select"
          [(value)]="customerTypeId"
          [options]="customerTypeOptions()"
          [disabled]="loadingCatalogs() || isEditing"
        />
        <ui-field
          label="Cantidad mínima"
          type="number"
          [(value)]="minQuantity"
          [disabled]="isEditing"
        />
        <ui-field label="Precio unitario" type="number" prefix="S/" [(value)]="unitPrice" />
      </div>

      @if (error()) {
        <div class="pfd-error">{{ error() }}</div>
      }

      <ng-container modalFooter>
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Guardar precio
        </button>
      </ng-container>
    </ui-modal>
  `,
  styles: [
    `
      .pfd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: var(--sp-4);
      }
      .pfd-error {
        color: var(--status-danger);
        font-size: var(--fs-dense);
        margin-top: var(--sp-3);
      }
    `,
  ],
})
export class PriceFormDialog {
  protected data = inject<PriceFormDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<PriceView | false>);
  private priceSvc = inject(PriceAdminService);
  private lookupSvc = inject(CatalogLookupService);

  protected isEditing = !!this.data.price;

  protected paymentConditionId = signal(String(this.data.price?.paymentConditionId ?? ''));
  protected customerTypeId = signal(String(this.data.price?.customerTypeId ?? ''));
  protected minQuantity = signal(String(this.data.price?.minQuantity ?? '1'));
  protected unitPrice = signal(String(this.data.price?.unitPrice ?? ''));

  protected paymentConditions = signal<PaymentConditionView[]>([]);
  protected customerTypes = signal<CustomerTypeView[]>([]);
  protected loadingCatalogs = signal(true);
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

  protected customerTypeOptions(): UiFieldOption[] {
    return [
      { value: '', label: 'Selecciona un tipo de cliente' },
      ...this.customerTypes().map((c) => ({ value: String(c.customerTypeId), label: c.name })),
    ];
  }

  constructor() {
    forkJoin({
      paymentConditions: this.lookupSvc.paymentConditions(),
      customerTypes: this.lookupSvc.customerTypes(),
    }).subscribe({
      next: ({ paymentConditions, customerTypes }) => {
        this.paymentConditions.set(paymentConditions);
        this.customerTypes.set(customerTypes);
        this.loadingCatalogs.set(false);
      },
      error: () => this.loadingCatalogs.set(false),
    });
  }

  protected submit() {
    const paymentConditionId = Number(this.paymentConditionId());
    const customerTypeId = Number(this.customerTypeId());
    const minQuantity = Number(this.minQuantity());
    const unitPrice = Number(this.unitPrice());

    if (!paymentConditionId || !customerTypeId) {
      this.error.set('Elige la condición de pago y el tipo de cliente.');
      return;
    }
    if (!(minQuantity >= 0.001)) {
      this.error.set('La cantidad mínima debe ser al menos 0.001.');
      return;
    }
    if (!(unitPrice >= 0.0001)) {
      this.error.set('El precio unitario debe ser al menos 0.0001.');
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
          this.error.set(detalle || 'No pudimos guardar el precio.');
        },
      });
  }
}
