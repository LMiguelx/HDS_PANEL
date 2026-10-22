import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { FleetModuleTabs } from './ui/module-tabs';
import { CreateTeamDialog } from './ui/create-team-dialog';
import { FleetAdminService } from './fleet-admin';
import { TeamView } from '../../shared/models/fleet.models';
import { dateText } from '../assignments/assignment-format';

/** Equipos vigentes (GET /api/fleet/teams — sin effectiveTo). */
@Component({
  selector: 'app-fleet-teams',
  imports: [UiButton, UiTable, UiEmpty, FleetModuleTabs],
  template: `
    <app-fleet-module-tabs />
    <section class="ft-page">
      <div class="ft-head">
        <div>
          <h1>Equipos</h1>
          <p class="ft-sub">{{ countText() }}</p>
        </div>
        <button uiButton variant="primary" (click)="openCreate()">Nuevo equipo</button>
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar los equipos."
        [empty]="!loading() && !error() && teams().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty
            title="Sin equipos vigentes"
            body="Arma el primer equipo (conductor + vehículo)."
          />
        </div>

        <table class="ui-table-grid ft-table-desktop">
          <thead>
            <tr>
              <th>Vehículo</th>
              <th>Conductor</th>
              <th>Ayudantes</th>
              <th>Vigente desde</th>
              <th>Vigente hasta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (t of teams(); track t.deliveryTeamId) {
              <tr>
                <td class="ft-cell-strong">{{ t.vehiclePlate }}</td>
                <td>{{ t.driverName }}</td>
                <td class="ft-muted">{{ membersText(t) }}</td>
                <td class="ft-muted">{{ dateText(t.effectiveFrom) }}</td>
                <td class="ft-muted">{{ dateText(t.effectiveTo) }}</td>
                <td class="ft-row-action">
                  <button
                    uiButton
                    variant="ghost"
                    size="sm"
                    [disabled]="closingId() === t.deliveryTeamId"
                    (click)="closeTeam(t)"
                  >
                    Cerrar equipo
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="ft-cards-mobile">
          @for (t of teams(); track t.deliveryTeamId) {
            <div class="ft-card-mobile">
              <div class="ft-card-mobile-name">{{ t.vehiclePlate }} · {{ t.driverName }}</div>
              <div class="ft-muted">{{ membersText(t) }}</div>
              <div class="ft-muted">
                {{ dateText(t.effectiveFrom) }} – {{ dateText(t.effectiveTo) }}
              </div>
              <button
                uiButton
                variant="ghost"
                size="sm"
                class="ft-card-mobile-action"
                [disabled]="closingId() === t.deliveryTeamId"
                (click)="closeTeam(t)"
              >
                Cerrar equipo
              </button>
            </div>
          }
        </div>
      </ui-table>
    </section>
  `,
  styles: [
    `
      .ft-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .ft-head {
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
      .ft-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .ft-cell-strong {
        font-weight: 800;
      }
      .ft-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .ft-row-action {
        text-align: right;
      }
      .ft-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .ft-page {
          padding: var(--sp-4);
        }
        .ft-table-desktop {
          display: none;
        }
        .ft-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .ft-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .ft-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .ft-card-mobile-action {
          margin-top: 6px;
          width: fit-content;
        }
      }
    `,
  ],
})
export class FleetTeamsPage {
  private fleetSvc = inject(FleetAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected dateText = dateText;

  protected teams = signal<TeamView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected closingId = signal<number | null>(null);

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.teams().length;
    return n === 1 ? '1 equipo vigente' : `${n} equipos vigentes`;
  }

  protected membersText(t: TeamView): string {
    return t.members.length ? t.members.map((m) => m.fullName).join(', ') : 'Sin ayudantes';
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.fleetSvc.teams().subscribe({
      next: (list) => {
        this.teams.set(list);
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
      .open(CreateTeamDialog, { width: '480px' })
      .afterClosed()
      .subscribe((created) => created && this.load());
  }

  protected closeTeam(t: TeamView) {
    this.dialog
      .confirm({
        title: 'Cerrar equipo',
        message: `¿Cerrar el equipo de ${t.vehiclePlate} (${t.driverName})?`,
        confirmLabel: 'Cerrar equipo',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.closingId.set(t.deliveryTeamId);
        this.fleetSvc.deactivateTeam(t.deliveryTeamId).subscribe({
          next: () => {
            this.closingId.set(null);
            this.toast.success(`Equipo de ${t.vehiclePlate} cerrado.`);
            this.load();
          },
          error: () => this.closingId.set(null),
        });
      });
  }
}
