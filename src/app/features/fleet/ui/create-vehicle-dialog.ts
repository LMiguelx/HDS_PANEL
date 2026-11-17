import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { FleetAdminService } from '../fleet-admin';

/** Registra un vehículo nuevo (POST /api/fleet/vehicles). */
@Component({
  selector: 'app-create-vehicle-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="cvd">
      <h2 class="cvd-title">Nuevo vehículo</h2>

      <ui-field label="Código" [(value)]="code" hint="Obligatorio, máximo 10 caracteres." />
      <ui-field label="Placa" [(value)]="plate" hint="Obligatorio, máximo 10 caracteres." />
      <ui-field label="Marca (opcional)" [(value)]="brandName" />
      <ui-field label="Capacidad (kg, opcional)" type="number" [(value)]="capacityKg" />

      @if (error()) {
        <div class="cvd-error">{{ error() }}</div>
      }

      <div class="cvd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Guardar vehículo
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
      .cvd {
        display: grid;
        gap: 16px;
      }
      .cvd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .cvd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .cvd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class CreateVehicleDialog {
  protected ref = inject(UiDialogRef<boolean>);
  private fleetSvc = inject(FleetAdminService);

  protected code = signal('');
  protected plate = signal('');
  protected brandName = signal('');
  protected capacityKg = signal('');
  protected saving = signal(false);
  protected error = signal('');

  protected submit() {
    const code = this.code().trim();
    const plate = this.plate().trim();
    if (!code || code.length > 10 || !plate || plate.length > 10) {
      this.error.set('Código y placa son obligatorios (máximo 10 caracteres cada uno).');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.fleetSvc
      .createVehicle({
        code,
        plate,
        brandName: this.brandName().trim() || undefined,
        capacityKg: this.capacityKg() ? Number(this.capacityKg()) : undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.ref.close(true);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(
            detalle ? `No pudimos guardar: ${detalle}` : 'No pudimos guardar el vehículo.',
          );
        },
      });
  }
}
