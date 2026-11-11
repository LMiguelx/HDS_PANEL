import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { FleetModuleTabs } from './ui/module-tabs';
import { CreateVehicleDialog } from './ui/create-vehicle-dialog';
import { FleetAdminService } from './fleet-admin';
import { VehicleView } from '../../shared/models/fleet.models';

/** Vehículos activos del tenant (GET /api/fleet/vehicles). */
@Component({
  selector: 'app-fleet-vehicles',
  imports: [UiButton, UiTable, UiEmpty, FleetModuleTabs],
  template: `
    <app-fleet-module-tabs />
    <section class="fv-page">
      <div class="fv-head">
        <div>
          <h1>Vehículos</h1>
          <p class="fv-sub">{{ countText() }}</p>
        </div>
        <button uiButton variant="primary" (click)="openCreate()">Nuevo vehículo</button>
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar los vehículos."
        [empty]="!loading() && !error() && vehicles().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty title="Sin vehículos" body="Registra el primer vehículo de la flota." />
        </div>

        <table class="ui-table-grid fv-table-desktop">
          <thead>
            <tr>
              <th>Código</th>
              <th>Placa</th>
              <th>Marca</th>
              <th>Capacidad</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (v of vehicles(); track v.vehicleId) {
              <tr>
                <td class="fv-cell-strong">{{ v.code }}</td>
                <td>{{ v.plate }}</td>
                <td class="fv-muted">{{ v.brandName || '—' }}</td>
                <td class="fv-muted">{{ v.capacityKg != null ? v.capacityKg + ' kg' : '—' }}</td>
                <td>
                  <span class="fv-badge" [class.fv-badge-active]="v.active">
                    {{ v.active ? 'Activo' : 'Dado de baja' }}
                  </span>
                </td>
                <td class="fv-row-action">
                  @if (v.active) {
                    <button
                      uiButton
                      variant="ghost"
                      size="sm"
                      [disabled]="deactivatingId() === v.vehicleId"
                      (click)="deactivate(v)"
                    >
                      Dar de baja
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="fv-cards-mobile">
          @for (v of vehicles(); track v.vehicleId) {
            <div class="fv-card-mobile">
              <div class="fv-card-mobile-head">
                <span class="fv-card-mobile-name">{{ v.code }} · {{ v.plate }}</span>
                <span class="fv-badge" [class.fv-badge-active]="v.active">
                  {{ v.active ? 'Activo' : 'Dado de baja' }}
                </span>
              </div>
              <div class="fv-muted">{{ v.brandName || 'Sin marca' }}</div>
              @if (v.active) {
                <button
                  uiButton
                  variant="ghost"
                  size="sm"
                  class="fv-card-mobile-action"
                  [disabled]="deactivatingId() === v.vehicleId"
                  (click)="deactivate(v)"
                >
                  Dar de baja
                </button>
              }
            </div>
          }
        </div>
      </ui-table>
    </section>
  `,
  styles: [
    `
      .fv-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .fv-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .fv-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .fv-cell-strong {
        font-weight: 800;
      }
      .fv-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .fv-badge {
        font-size: 12px;
        font-weight: 800;
        color: var(--ink-muted);
      }
      .fv-badge-active {
        color: var(--st-vigente);
      }
      .fv-row-action {
        text-align: right;
      }
      .fv-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .fv-page {
          padding: var(--sp-4);
        }
        .fv-table-desktop {
          display: none;
        }
        .fv-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .fv-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .fv-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .fv-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .fv-card-mobile-action {
          margin-top: 6px;
          width: fit-content;
        }
      }
    `,
  ],
})
export class FleetVehiclesPage {
  private fleetSvc = inject(FleetAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected vehicles = signal<VehicleView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected deactivatingId = signal<number | null>(null);

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.vehicles().length;
    return n === 1 ? '1 vehículo' : `${n} vehículos`;
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.fleetSvc.vehicles().subscribe({
      next: (list) => {
        this.vehicles.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected openCreate() {
    this.dialog
      .open(CreateVehicleDialog, { width: '440px' })
      .afterClosed()
      .subscribe((created) => created && this.load());
  }

  protected deactivate(v: VehicleView) {
    this.dialog
      .confirm({
        title: 'Dar de baja vehículo',
        message: `¿Dar de baja el vehículo ${v.plate} (${v.code})?`,
        confirmLabel: 'Dar de baja',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deactivatingId.set(v.vehicleId);
        this.fleetSvc.deactivateVehicle(v.vehicleId).subscribe({
          next: () => {
            this.deactivatingId.set(null);
            this.toast.success(`Vehículo ${v.plate} dado de baja.`);
            this.load();
          },
          error: () => this.deactivatingId.set(null),
        });
      });
  }
}
