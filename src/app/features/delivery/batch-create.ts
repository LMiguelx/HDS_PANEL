import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { ToastService } from '../../core/ui/toast';
import { DeliveryService } from './delivery';
import { FleetService } from './fleet';
import { TeamView } from '../../shared/models/fleet.models';
import { CreateBatchCommand } from '../../shared/models/delivery.models';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-batch-create',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Nueva planilla" subtitle="Armar carga: equipo + facturas"></app-page-header>

      <mat-card class="card">
        <div class="grid">
          <mat-form-field appearance="outline">
            <mat-label>Equipo (conductor + vehículo)</mat-label>
            <mat-select [value]="teamId()" (valueChange)="teamId.set($event)">
              @for (t of teams(); track t.deliveryTeamId) {
                <mat-option [value]="t.deliveryTeamId">
                  {{ t.driverName }} · {{ t.vehiclePlate }}
                  @if (t.capacityKg) {
                    ({{ t.capacityKg }} kg)
                  }
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Sede (branchId)</mat-label>
            <input
              matInput
              type="number"
              [value]="branchId() ?? ''"
              (input)="branchId.set(+$any($event.target).value || null)"
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Fecha</mat-label>
            <input
              matInput
              type="date"
              [value]="batchDate()"
              (input)="batchDate.set($any($event.target).value)"
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Serie</mat-label>
            <input
              matInput
              type="number"
              [value]="series()"
              (input)="series.set(+$any($event.target).value || 1)"
            />
          </mat-form-field>
        </div>
        @if (selectedTeam(); as t) {
          @if (t.capacityKg) {
            <p class="muted small">
              Capacidad del vehículo: {{ t.capacityKg }} kg. El backend valida el peso al armar.
            </p>
          }
        }
      </mat-card>

      <mat-card class="card">
        <h3>Facturas a cargar</h3>
        <div class="row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
            <mat-label>ID de factura (ej. F001-123)</mat-label>
            <input
              matInput
              [value]="invoiceInput()"
              (input)="invoiceInput.set($any($event.target).value)"
              (keyup.enter)="addInvoice()"
            />
          </mat-form-field>
          <button mat-stroked-button (click)="addInvoice()">
            <mat-icon>add</mat-icon>
            Agregar
          </button>
        </div>
        @if (invoiceIds().length) {
          <div class="chips">
            @for (id of invoiceIds(); track id) {
              <span class="chip"
              >{{ id }}
                <button (click)="removeInvoice(id)" aria-label="Quitar">✕</button></span
              >
            }
          </div>
        } @else {
          <p class="muted small">
            Agrega las facturas por su ID. (El selector de facturas pendientes se integrará con
            Facturación.)
          </p>
        }
      </mat-card>

      <div class="actions">
        <button
          mat-flat-button
          color="tertiary"
          [disabled]="!canCreate() || saving()"
          (click)="create()"
        >
          <mat-icon>local_shipping</mat-icon>
          Armar planilla
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .card {
        padding: 20px;
        margin-bottom: 16px;
        max-width: 760px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      @media (max-width: 640px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .row {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .grow {
        flex: 1 1 auto;
      }
      .small {
        font-size: 0.82rem;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
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
      .actions {
        max-width: 760px;
      }
    `,
  ],
})
export class BatchArmPage {
  private delivery = inject(DeliveryService);
  private fleet = inject(FleetService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly teams = signal<TeamView[]>([]);
  readonly teamId = signal<number | null>(null);
  readonly branchId = signal<number | null>(null);
  readonly batchDate = signal(today());
  readonly series = signal(1);

  readonly invoiceInput = signal('');
  readonly invoiceIds = signal<string[]>([]);
  readonly saving = signal(false);

  readonly selectedTeam = computed(
    () => this.teams().find((t) => t.deliveryTeamId === this.teamId()) ?? null,
  );

  constructor() {
    this.fleet
      .teams()
      .subscribe({ next: (t) => this.teams.set(t), error: () => this.teams.set([]) });
  }

  addInvoice() {
    const id = this.invoiceInput().trim();
    if (!id || this.invoiceIds().includes(id)) {
      this.invoiceInput.set('');
      return;
    }
    this.invoiceIds.update((l) => [...l, id]);
    this.invoiceInput.set('');
  }
  removeInvoice(id: string) {
    this.invoiceIds.update((l) => l.filter((x) => x !== id));
  }

  canCreate() {
    return (
      !!this.teamId() && !!this.branchId() && this.series() > 0 && this.invoiceIds().length > 0
    );
  }

  create() {
    if (!this.canCreate()) return;
    this.saving.set(true);
    const cmd: CreateBatchCommand = {
      branchId: this.branchId()!,
      batchDate: this.batchDate() || undefined,
      series: this.series(),
      deliveryTeamId: this.teamId()!,
      invoiceIds: this.invoiceIds(),
    };
    this.delivery.createBatch(cmd).subscribe({
      next: (b) => {
        this.toast.success('Planilla armada');
        void this.router.navigate(['/reparto', b.batchId]);
      },
      error: () => this.saving.set(false),
    });
  }
}
