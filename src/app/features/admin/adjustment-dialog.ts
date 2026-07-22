import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ToastService } from '../../core/ui/toast';
import { InventoryService } from './inventory';
import { CreateMovementCommand, WarehouseView } from '../../shared/models/inventory.models';

export interface AdjustmentData {
  productId: number;
  productName: string;
}

@Component({
  selector: 'app-adjustment-dialog',
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Ajuste manual</h2>
    <mat-dialog-content>
      <p class="muted">{{ data.productName }}</p>
      <mat-form-field appearance="outline" class="full"
        ><mat-label>Almacén</mat-label>
        <mat-select [value]="warehouseId()" (valueChange)="warehouseId.set($event)">
          @for (w of warehouses(); track w.warehouseId) {
            <mat-option [value]="w.warehouseId">{{ w.name }}</mat-option>
          }
        </mat-select></mat-form-field
      >
      <mat-form-field appearance="outline" class="full"
        ><mat-label>Cantidad (± ; negativo = merma)</mat-label>
        <input
          matInput
          type="number"
          [value]="quantity() || ''"
          (input)="quantity.set(+$any($event.target).value || 0)"
      /></mat-form-field>
      <mat-form-field appearance="outline" class="full"
        ><mat-label>Nota</mat-label>
        <input
          matInput
          [value]="note()"
          (input)="note.set($any($event.target).value)"
          maxlength="255"
      /></mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="tertiary" [disabled]="!canSave() || saving()" (click)="save()">
        Registrar ajuste
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full {
        width: 100%;
      }
      [mat-dialog-content] {
        min-width: 360px;
      }
    `,
  ],
})
export class AdjustmentDialog {
  readonly data = inject<AdjustmentData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<AdjustmentDialog>);
  private inventory = inject(InventoryService);
  private toast = inject(ToastService);

  readonly warehouses = signal<WarehouseView[]>([]);
  readonly warehouseId = signal<number | null>(null);
  readonly quantity = signal(0);
  readonly note = signal('');
  readonly saving = signal(false);

  constructor() {
    this.inventory
      .warehouses()
      .subscribe({ next: (w) => this.warehouses.set(w), error: () => this.warehouses.set([]) });
  }

  canSave() {
    return !!this.warehouseId() && this.quantity() !== 0 && !!this.note().trim();
  }

  save() {
    if (!this.canSave()) return;
    this.saving.set(true);
    const cmd: CreateMovementCommand = {
      warehouseId: this.warehouseId()!,
      productId: this.data.productId,
      quantity: this.quantity(),
      note: this.note().trim(),
    };
    this.inventory.createMovement(cmd).subscribe({
      next: () => {
        this.toast.success('Ajuste registrado');
        this.ref.close(true);
      },
      error: () => this.saving.set(false),
    });
  }
}
