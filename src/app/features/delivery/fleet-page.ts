import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { ToastService } from '../../core/ui/toast';
import { FleetService } from './fleet';
import {
  CreateTeamCommand,
  CreateTeamMember,
  CreateVehicleCommand,
  TeamView,
  VehicleView,
} from '../../shared/models/fleet.models';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
const ROLE_LABELS: Record<string, string> = { HELPER: 'Ayudante', CO_DRIVER: 'Copiloto' };

interface MemberDraft {
  userId: number;
  roleInTeam: string;
}

@Component({
  selector: 'app-fleet',
  imports: [
    DatePipe,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <app-page-header title="Flota" subtitle="Vehículos y equipos de reparto"></app-page-header>

      <!-- Vehículos -->
      <mat-card class="card">
        <h3>Vehículos</h3>

        <div class="form" *hasPermission="'delivery.settle'">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"
          >
            <mat-label>Sede (branchId)</mat-label>
            <input
              matInput
              type="number"
              [value]="vBranch() ?? ''"
              (input)="vBranch.set(+$any($event.target).value || null)"
            /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"
          >
            <mat-label>Código</mat-label>
            <input matInput [value]="vCode()" (input)="vCode.set($any($event.target).value)"
            /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"
          >
            <mat-label>Placa</mat-label>
            <input matInput [value]="vPlate()" (input)="vPlate.set($any($event.target).value)"
            /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"
          >
            <mat-label>Marca</mat-label>
            <input matInput [value]="vBrand()" (input)="vBrand.set($any($event.target).value)"
            /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"
          >
            <mat-label>Capacidad (kg)</mat-label>
            <input
              matInput
              type="number"
              [value]="vCap() || ''"
              (input)="vCap.set(+$any($event.target).value || 0)"
            /></mat-form-field>
          <button
            mat-flat-button
            color="tertiary"
            [disabled]="!canAddVehicle()"
            (click)="addVehicle()"
          >
            <mat-icon>add</mat-icon>
            Agregar
          </button>
        </div>

        <div class="list">
          <div class="vrow head">
            <span>Código</span><span>Placa</span><span>Marca</span><span>Capacidad</span
          ><span></span>
          </div>
          @for (v of vehicles(); track v.vehicleId) {
            <div class="vrow">
              <span>{{ v.code }}</span>
              <span>{{ v.plate }}</span>
              <span class="muted">{{ v.brandName ?? '—' }}</span>
              <span class="num">{{ v.capacityKg }} kg</span>
              <button *hasPermission="'delivery.settle'" mat-button (click)="deactivateVehicle(v)">
                Dar de baja
              </button>
            </div>
          } @empty {
            <p class="muted">No hay vehículos activos.</p>
          }
        </div>
      </mat-card>

      <!-- Equipos -->
      <mat-card class="card">
        <h3>Equipos</h3>

        <div class="teamform" *hasPermission="'delivery.settle'">
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic"
            >
              <mat-label>Vehículo</mat-label>
              <mat-select [value]="tVehicle()" (valueChange)="tVehicle.set($event)">
                @for (v of vehicles(); track v.vehicleId) {
                  <mat-option [value]="v.vehicleId">{{ v.code }} · {{ v.plate }}</mat-option>
                }
              </mat-select>
            </mat-form-field
            >
            <mat-form-field appearance="outline" subscriptSizing="dynamic"
            >
              <mat-label>Conductor (userId)</mat-label>
              <input
                matInput
                type="number"
                [value]="tDriver() ?? ''"
                (input)="tDriver.set(+$any($event.target).value || null)"
              /></mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"
            >
              <mat-label>Vigente desde</mat-label>
              <input
                matInput
                type="date"
                [value]="tFrom()"
                (input)="tFrom.set($any($event.target).value)"
              /></mat-form-field>
          </div>

          <div class="members">
            <span class="muted small">Miembros:</span>
            @for (m of members(); track m.userId) {
              <span class="chip"
              >#{{ m.userId }} · {{ roleLabel(m.roleInTeam) }}
                <button (click)="removeMember(m.userId)" aria-label="Quitar">✕</button></span
              >
            }
            <div class="addmember">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mu"
              >
                <mat-label>userId</mat-label>
                <input
                  matInput
                  type="number"
                  [value]="mUser() ?? ''"
                  (input)="mUser.set(+$any($event.target).value || null)"
                /></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"
              >
                <mat-label>Rol</mat-label>
                <mat-select [value]="mRole()" (valueChange)="mRole.set($event)">
                  <mat-option value="HELPER">Ayudante</mat-option>
                  <mat-option value="CO_DRIVER">Copiloto</mat-option>
                </mat-select>
              </mat-form-field
              >
              <button mat-stroked-button [disabled]="!mUser()" (click)="addMember()">
                Añadir miembro
              </button>
            </div>
          </div>

          <button
            mat-flat-button
            color="tertiary"
            [disabled]="!canCreateTeam()"
            (click)="createTeam()"
          >
            <mat-icon>groups</mat-icon>
            Crear equipo
          </button>
          <p class="muted small">
            Temporal: conductor y miembros por userId (falta el endpoint de listar usuarios). El
            backend cierra los equipos en conflicto (mismo conductor o vehículo).
          </p>
        </div>

        <div class="list">
          @for (t of teams(); track t.deliveryTeamId) {
            <div class="team">
              <div class="tinfo">
                <strong>{{ t.driverName }}</strong>
                <span class="muted">· {{ t.vehiclePlate }}</span>
                <span class="muted small">
                  Desde {{
                    t.effectiveFrom | date: 'dd/MM/yy'
                  }}{{
                    t.effectiveTo ? ' hasta ' + (t.effectiveTo | date: 'dd/MM/yy') : ' · vigente'
                  }}
                </span>
                @if (t.members?.length) {
                  <span class="muted small">{{ membersText(t) }}</span>
                }
              </div>
              @if (!t.effectiveTo) {
                <div class="endrow" *hasPermission="'delivery.settle'">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mu">
                    <mat-label>Último día</mat-label>
                    <input
                      matInput
                      type="date"
                      [value]="endDateFor(t.deliveryTeamId)"
                      (input)="setEndDate(t.deliveryTeamId, $any($event.target).value)"
                    />
                  </mat-form-field>
                  <button mat-stroked-button (click)="closeTeam(t)">Cerrar equipo</button>
                </div>
              }
            </div>
          } @empty {
            <p class="muted">No hay equipos.</p>
          }
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .card {
        padding: 20px;
        margin-bottom: 16px;
        max-width: 900px;
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .form {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .list {
        display: flex;
        flex-direction: column;
      }
      .vrow {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 120px 120px;
        gap: 8px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .vrow.head {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.8rem;
        border-bottom: 2px solid var(--mat-sys-outline-variant);
      }
      .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .teamform {
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 16px;
      }
      .row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .members {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin: 10px 0;
      }
      .addmember {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .mu {
        width: 120px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 6px 4px 12px;
        border-radius: 999px;
        background: var(--mat-sys-surface-container-high);
      }
      .chip button {
        border: 0;
        background: transparent;
        cursor: pointer;
        font: inherit;
      }
      .small {
        font-size: 0.8rem;
      }
      .team {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        flex-wrap: wrap;
      }
      .tinfo {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .endrow {
        display: flex;
        gap: 8px;
        align-items: center;
      }
    `,
  ],
})
export class FleetPage {
  private fleet = inject(FleetService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly vehicles = signal<VehicleView[]>([]);
  readonly teams = signal<TeamView[]>([]);

  // Form vehículo
  readonly vBranch = signal<number | null>(null);
  readonly vCode = signal('');
  readonly vPlate = signal('');
  readonly vBrand = signal('');
  readonly vCap = signal(0);

  // Form equipo
  readonly tVehicle = signal<number | null>(null);
  readonly tDriver = signal<number | null>(null);
  readonly tFrom = signal(today());
  readonly members = signal<MemberDraft[]>([]);
  readonly mUser = signal<number | null>(null);
  readonly mRole = signal('HELPER');

  readonly endDates = signal<Record<number, string>>({});

  constructor() {
    this.loadVehicles();
    this.loadTeams();
  }

  roleLabel(code: string) {
    return ROLE_LABELS[code] ?? code;
  }
  membersText(t: TeamView) {
    return (t.members ?? [])
      .map((m) => `${m.userName ?? '#' + m.userId} (${this.roleLabel(m.roleInTeam)})`)
      .join(', ');
  }

  // ── Vehículos ──
  canAddVehicle() {
    return !!this.vBranch() && !!this.vCode().trim() && !!this.vPlate().trim() && this.vCap() > 0;
  }
  addVehicle() {
    if (!this.canAddVehicle()) return;
    const cmd: CreateVehicleCommand = {
      branchId: this.vBranch()!,
      code: this.vCode().trim(),
      plate: this.vPlate().trim(),
      brandName: this.vBrand() || undefined,
      capacityKg: this.vCap(),
    };
    this.fleet.createVehicle(cmd).subscribe({
      next: () => {
        this.toast.success('Vehículo agregado');
        this.vCode.set('');
        this.vPlate.set('');
        this.vBrand.set('');
        this.vCap.set(0);
        this.loadVehicles();
      },
      error: () => {},
    });
  }
  deactivateVehicle(v: VehicleView) {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Dar de baja',
          message: `Vehículo ${v.code} · ${v.plate}.`,
          confirmText: 'Dar de baja',
          danger: true,
        },
        width: '380px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.fleet.deactivateVehicle(v.vehicleId).subscribe({
          next: () => {
            this.toast.success('Vehículo dado de baja');
            this.loadVehicles();
          },
          error: () => {},
        });
      });
  }

  // ── Equipos ──
  addMember() {
    const id = this.mUser();
    if (!id || this.members().some((m) => m.userId === id)) return;
    this.members.update((l) => [...l, { userId: id, roleInTeam: this.mRole() }]);
    this.mUser.set(null);
  }
  removeMember(userId: number) {
    this.members.update((l) => l.filter((m) => m.userId !== userId));
  }

  canCreateTeam() {
    return !!this.tVehicle() && !!this.tDriver() && !!this.tFrom();
  }
  createTeam() {
    if (!this.canCreateTeam()) return;
    const cmd: CreateTeamCommand = {
      vehicleId: this.tVehicle()!,
      driverUserId: this.tDriver()!,
      effectiveFrom: this.tFrom(),
      members: this.members().map(
        (m) => ({ userId: m.userId, roleInTeam: m.roleInTeam }) as CreateTeamMember,
      ),
    };
    this.fleet.createTeam(cmd).subscribe({
      next: () => {
        this.toast.success('Equipo creado');
        this.tVehicle.set(null);
        this.tDriver.set(null);
        this.members.set([]);
        this.loadTeams();
      },
      error: () => {},
    });
  }

  endDateFor(id: number) {
    return this.endDates()[id] ?? today();
  }
  setEndDate(id: number, v: string) {
    this.endDates.update((m) => ({ ...m, [id]: v }));
  }
  closeTeam(t: TeamView) {
    const lastDay = this.endDateFor(t.deliveryTeamId);
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Cerrar equipo',
          message: `${t.driverName} · ${t.vehiclePlate} — último día ${lastDay}.`,
          confirmText: 'Cerrar',
        },
        width: '400px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.fleet.endTeam(t.deliveryTeamId, lastDay).subscribe({
          next: () => {
            this.toast.success('Equipo cerrado');
            this.loadTeams();
          },
          error: () => {},
        });
      });
  }

  private loadVehicles() {
    this.fleet
      .vehicles()
      .subscribe({ next: (v) => this.vehicles.set(v), error: () => this.vehicles.set([]) });
  }
  private loadTeams() {
    this.fleet
      .teams()
      .subscribe({ next: (t) => this.teams.set(t), error: () => this.teams.set([]) });
  }
}
