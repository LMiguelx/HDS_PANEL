import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { ToastService } from '../../core/ui/toast';
import { DeliveryService } from './delivery';
import { FleetService } from './fleet';
import { InvoiceService } from '../billing/invoice';
import { TeamView } from '../../shared/models/fleet.models';
import { CreateBatchCommand } from '../../shared/models/delivery.models';
import { InvoiceSummary } from '../../shared/models/invoice.models';

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
    MatCheckboxModule,
    PageHeaderComponent,
    DecimalPipe,
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
        @if (!branchId()) {
          <p class="muted small">Elige la sede para ver las facturas listas para planilla.</p>
        } @else if (loadingInvoices()) {
          <p class="muted small">Cargando facturas…</p>
        } @else if (!availableInvoices().length) {
          <p class="muted small">
            No hay facturas conciliadas sin planilla para esta sede y fecha.
          </p>
        } @else {
          <div class="invoice-list">
            @for (inv of availableInvoices(); track inv.invoiceId) {
              <label class="invoice-row">
                <mat-checkbox
                  [checked]="invoiceIds().includes(inv.invoiceId)"
                  (change)="toggleInvoice(inv.invoiceId)"
                ></mat-checkbox>
                <span class="inv-id">{{ inv.invoiceId }}</span>
                <span class="inv-customer">{{ inv.customerName }}</span>
                <span class="inv-amount">{{ inv.totalAmount | number: '1.2-2' }}</span>
              </label>
            }
          </div>
        }
        @if (invoiceIds().length) {
          <p class="muted small">{{ invoiceIds().length }} factura(s) seleccionada(s).</p>
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
        padding: var(--sp-5);
        margin-bottom: var(--sp-4);
        max-width: var(--card-w-md);
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
      .invoice-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 320px;
        overflow-y: auto;
      }
      .invoice-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 4px;
        cursor: pointer;
      }
      .inv-id {
        font-variant-numeric: tabular-nums;
        min-width: 110px;
      }
      .inv-customer {
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .inv-amount {
        font-variant-numeric: tabular-nums;
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
  private invoices = inject(InvoiceService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly teams = signal<TeamView[]>([]);
  readonly teamId = signal<number | null>(null);
  readonly branchId = signal<number | null>(null);
  readonly batchDate = signal(today());
  readonly series = signal(1);

  readonly availableInvoices = signal<InvoiceSummary[]>([]);
  readonly loadingInvoices = signal(false);
  readonly invoiceIds = signal<string[]>([]);
  readonly saving = signal(false);

  readonly selectedTeam = computed(
    () => this.teams().find((t) => t.deliveryTeamId === this.teamId()) ?? null,
  );

  constructor() {
    this.fleet
      .teams()
      .subscribe({ next: (t) => this.teams.set(t), error: () => this.teams.set([]) });

    effect(() => {
      const branchId = this.branchId();
      const batchDate = this.batchDate();
      if (!branchId) {
        this.availableInvoices.set([]);
        this.invoiceIds.set([]);
        return;
      }
      this.loadingInvoices.set(true);
      this.invoices.readyForBatch(branchId, batchDate || undefined).subscribe({
        next: (page) => {
          this.availableInvoices.set(page.content);
          const ids = new Set(page.content.map((i) => i.invoiceId));
          this.invoiceIds.update((selected) => selected.filter((id) => ids.has(id)));
          this.loadingInvoices.set(false);
        },
        error: () => {
          this.availableInvoices.set([]);
          this.loadingInvoices.set(false);
        },
      });
    });
  }

  toggleInvoice(id: string) {
    this.invoiceIds.update((l) =>
      l.includes(id) ? l.filter((x) => x !== id) : [...l, id],
    );
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
