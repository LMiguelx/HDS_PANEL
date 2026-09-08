import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { FleetAdminService } from '../fleet-admin';
import { AvailableHelperView } from '../../../shared/models/fleet.models';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const MAX_HELPERS = 2;

/**
 * Arma un equipo (conductor + vehículo + hasta 2 ayudantes) —
 * POST /api/fleet/teams. Si el conductor o el vehículo ya tenían equipo
 * abierto, el backend lo cierra automáticamente (rotación).
 */
@Component({
  selector: 'app-create-team-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="ctd">
      <h2 class="ctd-title">Nuevo equipo</h2>

      @if (loadingOptions()) {
        <div class="ctd-skeleton" role="status" aria-label="Cargando"></div>
      } @else {
        <ui-field
          label="Vehículo"
          type="select"
          [(value)]="vehicleId"
          [options]="vehicleOptions()"
        />
        <ui-field
          label="Conductor"
          type="select"
          [(value)]="driverUserId"
          [options]="driverOptions()"
        />
        <ui-field label="Vigente desde" type="date" [(value)]="effectiveFrom" />

        <div class="ctd-helpers">
          <span class="ctd-helpers-label">Ayudantes (opcional, máximo {{ maxHelpers }})</span>
          @if (pickedHelpers().length > 0) {
            <div class="ctd-helper-chips">
              @for (h of pickedHelpers(); track h.userId) {
                <span class="ctd-helper-chip">
                  {{ h.fullName }}
                  <button type="button" aria-label="Quitar" (click)="removeHelper(h.userId)">
                    ✕
                  </button>
                </span>
              }
            </div>
          }
          @if (pickedHelpers().length < maxHelpers && remainingHelperOptions().length > 1) {
            <div class="ctd-helper-add">
              <ui-field
                label="Agregar ayudante"
                type="select"
                [(value)]="helperToAdd"
                [options]="remainingHelperOptions()"
              />
              <button
                uiButton
                variant="secondary"
                size="sm"
                [disabled]="!helperToAdd()"
                (click)="addHelper()"
              >
                Agregar
              </button>
            </div>
          }
        </div>
      }

      @if (error()) {
        <div class="ctd-error">{{ error() }}</div>
      }

      <div class="ctd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Guardar equipo
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
      .ctd {
        display: grid;
        gap: 16px;
      }
      .ctd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .ctd-skeleton {
        height: 160px;
        background: var(--faint);
      }
      .ctd-helpers {
        display: grid;
        gap: 8px;
      }
      .ctd-helpers-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .ctd-helper-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ctd-helper-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 800;
        padding: 4px 6px 4px 10px;
        border: 1px solid var(--divider);
        color: var(--ink);
      }
      .ctd-helper-chip button {
        appearance: none;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 12px;
        padding: 2px;
      }
      .ctd-helper-add {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: end;
      }
      .ctd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .ctd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class CreateTeamDialog {
  protected ref = inject(UiDialogRef<boolean>);
  private fleetSvc = inject(FleetAdminService);

  protected maxHelpers = MAX_HELPERS;
  protected loadingOptions = signal(true);
  protected vehicleOptions = signal<UiFieldOption[]>([]);
  protected driverOptions = signal<UiFieldOption[]>([]);
  private helpers = signal<AvailableHelperView[]>([]);

  protected vehicleId = signal('');
  protected driverUserId = signal('');
  protected effectiveFrom = signal(todayIso());
  protected pickedHelpers = signal<AvailableHelperView[]>([]);
  protected helperToAdd = signal('');
  protected saving = signal(false);
  protected error = signal('');

  protected remainingHelperOptions = computed<UiFieldOption[]>(() => {
    const pickedIds = new Set(this.pickedHelpers().map((h) => h.userId));
    const remaining = this.helpers().filter((h) => !pickedIds.has(h.userId));
    return [
      { value: '', label: 'Elige un ayudante' },
      ...remaining.map((h) => ({ value: String(h.userId), label: h.fullName })),
    ];
  });

  constructor() {
    forkJoin({
      vehicles: this.fleetSvc.vehicles(),
      drivers: this.fleetSvc.availableDrivers(),
      helpers: this.fleetSvc.availableHelpers(),
    }).subscribe(({ vehicles, drivers, helpers }) => {
      this.vehicleOptions.set([
        { value: '', label: 'Elige un vehículo' },
        ...vehicles
          .filter((v) => v.active)
          .map((v) => ({ value: String(v.vehicleId), label: `${v.plate} · ${v.code}` })),
      ]);
      this.driverOptions.set([
        { value: '', label: 'Elige un conductor' },
        ...drivers.map((d) => ({ value: String(d.userId), label: d.fullName })),
      ]);
      this.helpers.set(helpers);
      this.loadingOptions.set(false);
    });
  }

  protected addHelper() {
    const id = Number(this.helperToAdd());
    const helper = this.helpers().find((h) => h.userId === id);
    if (!helper || this.pickedHelpers().length >= this.maxHelpers) return;
    this.pickedHelpers.update((list) => [...list, helper]);
    this.helperToAdd.set('');
  }

  protected removeHelper(userId: number) {
    this.pickedHelpers.update((list) => list.filter((h) => h.userId !== userId));
  }

  protected submit() {
    const vehicleId = Number(this.vehicleId());
    const driverUserId = Number(this.driverUserId());
    if (!vehicleId || !driverUserId || !this.effectiveFrom()) {
      this.error.set('Completa vehículo, conductor y fecha de vigencia.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.fleetSvc
      .createTeam({
        vehicleId,
        driverUserId,
        effectiveFrom: this.effectiveFrom(),
        members: this.pickedHelpers().map((h) => ({ userId: h.userId, roleInTeam: 'HELPER' })),
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
            detalle ? `No pudimos guardar: ${detalle}` : 'No pudimos guardar el equipo.',
          );
        },
      });
  }
}
