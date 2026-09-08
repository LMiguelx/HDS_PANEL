import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { FleetAdminService } from '../fleet-admin';

export interface EndTeamDialogData {
  teamId: number;
  vehiclePlate: string;
  driverName: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Cierra la vigencia de un equipo (POST /api/fleet/teams/{id}/end). */
@Component({
  selector: 'app-end-team-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="etd">
      <h2 class="etd-title">Cerrar equipo</h2>
      <p class="etd-sub">{{ data.vehiclePlate }} · {{ data.driverName }}</p>

      <ui-field label="Último día" type="date" [(value)]="lastDay" />

      @if (error()) {
        <div class="etd-error">{{ error() }}</div>
      }

      <div class="etd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Cerrar equipo
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
      .etd {
        display: grid;
        gap: 16px;
      }
      .etd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .etd-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .etd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .etd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class EndTeamDialog {
  protected data = inject<EndTeamDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private fleetSvc = inject(FleetAdminService);

  protected lastDay = signal(todayIso());
  protected saving = signal(false);
  protected error = signal('');

  protected submit() {
    this.saving.set(true);
    this.error.set('');
    this.fleetSvc.endTeam(this.data.teamId, this.lastDay() || undefined).subscribe({
      next: () => {
        this.saving.set(false);
        this.ref.close(true);
      },
      error: (err) => {
        this.saving.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(
          detalle ? `No pudimos cerrar el equipo: ${detalle}` : 'No pudimos cerrar el equipo.',
        );
      },
    });
  }
}
