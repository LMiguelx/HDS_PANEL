import { Component, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../core/ui/toast';
import { DeliveryService } from './delivery';
import { ProductPickerDialog } from '../promos/product-picker-dialog';
import { Product } from '../../shared/models/catalog.models';
import { CreateReturnCommand, ReturnReasonView } from '../../shared/models/delivery.models';

export interface ReturnDialogData {
  invoiceId: string;
  customerName?: string;
}

@Component({
  selector: 'app-return-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Registrar devolución</h2>
    <mat-dialog-content>
      <p class="muted">
        Factura {{ data.invoiceId }}
        @if (data.customerName) {
          · {{ data.customerName }}
        }
      </p>

      <button mat-stroked-button (click)="pickProduct()">
        <mat-icon>inventory_2</mat-icon> {{ productName() || 'Elegir producto' }}
      </button>

      <div class="grid">
        <mat-form-field appearance="outline"
          ><mat-label>Cantidad</mat-label>
          <input
            matInput
            type="number"
            [value]="quantity() || ''"
            (input)="quantity.set(+$any($event.target).value || 0)"
        /></mat-form-field>
        <mat-form-field appearance="outline"
          ><mat-label>Monto (S/)</mat-label>
          <input
            matInput
            type="number"
            [value]="amount() || ''"
            (input)="amount.set(+$any($event.target).value || 0)"
        /></mat-form-field>
      </div>

      <mat-form-field appearance="outline" class="full"
        ><mat-label>Motivo</mat-label>
        <mat-select [value]="reasonId()" (valueChange)="reasonId.set($event)">
          @for (r of reasons(); track r.returnReasonId) {
            <mat-option [value]="r.returnReasonId">{{ r.name }}</mat-option>
          }
        </mat-select></mat-form-field
      >
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="tertiary" [disabled]="!canSave() || saving()" (click)="save()">
        Registrar
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 12px;
      }
      .full {
        width: 100%;
      }
      [mat-dialog-content] {
        min-width: 380px;
      }
    `,
  ],
})
export class ReturnDialog {
  readonly data = inject<ReturnDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ReturnDialog>);
  private delivery = inject(DeliveryService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly reasons = signal<ReturnReasonView[]>([]);
  readonly productId = signal<number | null>(null);
  readonly productName = signal('');
  readonly quantity = signal(0);
  readonly amount = signal(0);
  readonly reasonId = signal<number | null>(null);
  readonly saving = signal(false);

  constructor() {
    this.delivery
      .returnReasons()
      .subscribe({ next: (r) => this.reasons.set(r), error: () => this.reasons.set([]) });
  }

  pickProduct() {
    this.dialog
      .open(ProductPickerDialog, { width: '460px' })
      .afterClosed()
      .subscribe((p?: Product) => {
        if (p) {
          this.productId.set(p.productId);
          this.productName.set(p.name);
        }
      });
  }

  canSave() {
    return !!this.productId() && this.quantity() > 0 && this.amount() > 0 && !!this.reasonId();
  }

  save() {
    if (!this.canSave()) return;
    this.saving.set(true);
    const cmd: CreateReturnCommand = {
      invoiceId: this.data.invoiceId,
      productId: this.productId()!,
      quantity: this.quantity(),
      amount: this.amount(),
      returnReasonId: this.reasonId()!,
    };
    this.delivery.createReturn(cmd).subscribe({
      next: () => {
        this.toast.success('Devolución registrada, se avisó al vendedor');
        this.ref.close(true);
      },
      error: () => this.saving.set(false),
    });
  }
}
