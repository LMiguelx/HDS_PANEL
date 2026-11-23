import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { FleetAdminService } from '../../fleet/fleet-admin';
import { DeliveryAdminService } from '../delivery-admin';

export interface AssignTeamDialogData {
  batchId: number;
}

/**
 * Asigna o reasigna el equipo responsable de la planilla — solo funciona
 * mientras está OPEN (PATCH /api/deliveries/batches/{id}/team).
 */
@Component({
  selector: 'app-assign-team-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="atd">
      <h2 class="atd-title">Asignar equipo</h2>

      @if (loadingTeams()) {
        <div class="atd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (teamOptions().length <= 1) {
        <p class="atd-empty">No hay equipos vigentes. Arma uno primero en Flota.</p>
      } @else {
        <ui-field label="Equipo" type="select" [(value)]="teamId" [options]="teamOptions()" />
      }

      @if (error()) {
        <div class="atd-error">{{ error() }}</div>
      }

      <div class="atd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button
          uiButton
          variant="primary"
          [loading]="saving()"
          [disabled]="!teamId()"
          (click)="submit()"
        >
          Asignar
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
      .atd {
        display: grid;
        gap: 16px;
      }
      .atd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .atd-skeleton {
        height: 60px;
        background: var(--faint);
      }
      .atd-empty {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .atd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .atd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class AssignTeamDialog {
  protected data = inject<AssignTeamDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private fleetSvc = inject(FleetAdminService);
  private deliverySvc = inject(DeliveryAdminService);

  protected loadingTeams = signal(true);
  protected teamOptions = signal<UiFieldOption[]>([]);
  protected teamId = signal('');
  protected saving = signal(false);
  protected error = signal('');

  constructor() {
    this.fleetSvc.teams().subscribe((teams) => {
      this.teamOptions.set([
        { value: '', label: 'Elige un equipo' },
        ...teams.map((t) => ({
          value: String(t.deliveryTeamId),
          label: `${t.vehiclePlate} · ${t.driverName}`,
        })),
      ]);
      this.loadingTeams.set(false);
    });
  }

  protected submit() {
    const deliveryTeamId = Number(this.teamId());
    if (!deliveryTeamId) return;
    this.saving.set(true);
    this.error.set('');
    this.deliverySvc.assignTeam(this.data.batchId, { deliveryTeamId }).subscribe({
      next: () => {
        this.saving.set(false);
        this.ref.close(true);
      },
      error: (err) => {
        this.saving.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(
          detalle ? `No pudimos asignar: ${detalle}` : 'No pudimos asignar el equipo.',
        );
      },
    });
  }
}
