import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { WeekdayPickerComponent } from '../../shared/components/weekday-picker';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { ToastService } from '../../core/ui/toast';
import { CustomerService } from './customer';
import { AssignmentService } from './assignment';
import { CustomerSummary } from '../../shared/models/customer.models';
import { AssignmentView } from '../../shared/models/assignment.models';

@Component({
  selector: 'app-assignments',
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    PageHeaderComponent,
    WeekdayPickerComponent,
    WeekdayPickerComponent,
  ],
  template: `
    <div class="page">
      <app-page-header
        title="Asignaciones"
        subtitle="Cartera de vendedores (quién atiende a quién)"
      />

      <div class="tabs">
        <button [class.active]="mode() === 'customer'" (click)="mode.set('customer')">
          Por cliente
        </button>
        <button [class.active]="mode() === 'user'" (click)="mode.set('user')">Por vendedor</button>
      </div>

      @if (mode() === 'customer') {
        <div class="row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
            <mat-icon matPrefix>search</mat-icon>
            <mat-label>Buscar cliente</mat-label>
            <input
              matInput
              [value]="custQuery()"
              (input)="custQuery.set($any($event.target).value)"
              (keyup.enter)="searchCustomers()"
            />
          </mat-form-field>
          <button mat-flat-button color="primary" (click)="searchCustomers()">Buscar</button>
        </div>

        @if (custResults().length) {
          <mat-card class="card list">
            @for (c of custResults(); track c.customerId) {
              <button class="row-item" (click)="selectCustomer(c)">
                <span>{{ c.businessName }}</span>
                <span class="muted">{{ c.documentNumber }}</span>
              </button>
            }
          </mat-card>
        }

        @if (selectedCustomer(); as c) {
          <mat-card class="card">
            <h2>{{ c.businessName }}</h2>

            <h3>Asignaciones</h3>
            @for (a of custAssignments(); track a.assignmentId) {
              <div class="assign">
                <div>
                  <strong
                    >Vendedor #{{ a.userId }}{{ a.userName ? ' · ' + a.userName : '' }}</strong
                  >
                  <p class="muted small">
                    Desde {{ a.effectiveFrom | date: 'dd/MM/yyyy' }}
                    @if (a.lastDay) {
                      · hasta {{ a.lastDay | date: 'dd/MM/yyyy' }}
                    } @else {
                      · vigente
                    }
                    · Días: {{ weekdayLabels(a.weekdays) }}
                  </p>
                </div>
                @if (!a.lastDay) {
                  <button mat-stroked-button (click)="endAssignment(a)">
                    <mat-icon>event_busy</mat-icon> Cerrar
                  </button>
                }
              </div>
            } @empty {
              <p class="muted">Sin asignaciones.</p>
            }

            <h3>Nueva asignación</h3>
            <div class="form">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>ID del vendedor</mat-label>
                <input
                  matInput
                  type="number"
                  [value]="formUserId() ?? ''"
                  (input)="formUserId.set(+$any($event.target).value || null)"
                />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Desde</mat-label>
                <input
                  matInput
                  type="date"
                  [value]="formFrom()"
                  (input)="formFrom.set($any($event.target).value)"
                />
              </mat-form-field>
              <div class="days">
                <span class="muted small">Días de visita</span>
                <app-weekday-picker [(value)]="formDays" />
              </div>
              <button
                mat-flat-button
                color="primary"
                [disabled]="!canCreate()"
                (click)="createAssignment()"
              >
                Asignar
              </button>
            </div>
            <p class="muted small note">
              El ID del vendedor es temporal: falta un endpoint que liste vendedores (propuesta
              backend).
            </p>
          </mat-card>
        }
      } @else {
        <div class="row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>ID del vendedor</mat-label>
            <input
              matInput
              type="number"
              [value]="userIdInput() ?? ''"
              (input)="userIdInput.set(+$any($event.target).value || null)"
              (keyup.enter)="loadUserAssignments()"
            />
          </mat-form-field>
          <button
            mat-flat-button
            color="primary"
            [disabled]="!userIdInput()"
            (click)="loadUserAssignments()"
          >
            Cargar cartera
          </button>
        </div>

        @if (userAssignments().length) {
          <mat-card class="card">
            <h3>Cartera del vendedor #{{ userIdInput() }}</h3>
            @for (a of userAssignments(); track a.assignmentId) {
              <div class="assign">
                <div>
                  <strong>{{ a.customerName ?? 'Cliente #' + a.customerId }}</strong>
                  <p class="muted small">
                    Desde {{ a.effectiveFrom | date: 'dd/MM/yyyy' }}
                    @if (a.lastDay) {
                      · hasta {{ a.lastDay | date: 'dd/MM/yyyy' }}
                    } @else {
                      · vigente
                    }
                    · Días: {{ weekdayLabels(a.weekdays) }}
                  </p>
                </div>
                @if (!a.lastDay) {
                  <button mat-stroked-button (click)="endAssignment(a)">
                    <mat-icon>event_busy</mat-icon> Cerrar
                  </button>
                }
              </div>
            }
          </mat-card>
        }
      }
    </div>
  `,
  styles: [
    `
      .tabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        margin-bottom: 16px;
      }
      .tabs button {
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 10px 16px;
        font: inherit;
        color: var(--mat-sys-on-surface-variant);
        border-bottom: 2px solid transparent;
      }
      .tabs button.active {
        color: var(--mat-sys-primary);
        border-bottom-color: var(--mat-sys-primary);
        font-weight: 600;
      }
      .row {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin-bottom: 12px;
        max-width: 640px;
      }
      .grow {
        flex: 1 1 auto;
      }
      .card {
        padding: 16px;
        margin-bottom: 12px;
        max-width: 640px;
      }
      .list {
        display: flex;
        flex-direction: column;
        padding: 4px;
      }
      .row-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        text-align: left;
        width: 100%;
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 10px 12px;
        border-radius: 8px;
        font: inherit;
      }
      .row-item:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }
      h2 {
        margin: 0 0 8px;
      }
      h3 {
        margin: 16px 0 8px;
        font-size: 1rem;
      }
      .assign {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .assign p {
        margin: 2px 0 0;
      }
      .small {
        font-size: 0.82rem;
      }
      .form {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        margin-top: 8px;
      }
      .days {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .note {
        margin-top: 10px;
      }
    `,
  ],
})
export class AssignmentsPage {
  private assignments = inject(AssignmentService);
  private customers = inject(CustomerService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly mode = signal<'customer' | 'user'>('customer');

  // Por cliente
  readonly custQuery = signal('');
  readonly custResults = signal<CustomerSummary[]>([]);
  readonly selectedCustomer = signal<CustomerSummary | null>(null);
  readonly custAssignments = signal<AssignmentView[]>([]);

  // Formulario de nueva asignación
  readonly formUserId = signal<number | null>(null);
  readonly formFrom = signal<string>(this.today());
  formDays = signal<number[]>([]);

  // Por vendedor
  readonly userIdInput = signal<number | null>(null);
  readonly userAssignments = signal<AssignmentView[]>([]);

  private readonly WD = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sáb', 'Dom'];

  canCreate() {
    return !!this.selectedCustomer() && !!this.formUserId() && !!this.formFrom();
  }

  searchCustomers() {
    const q = this.custQuery().trim();
    if (!q) return;
    this.customers.search(q, 0, 10).subscribe({
      next: (r) => this.custResults.set(r.content),
      error: () => this.custResults.set([]),
    });
  }

  selectCustomer(c: CustomerSummary) {
    this.selectedCustomer.set(c);
    this.custResults.set([]);
    this.custQuery.set(c.businessName);
    this.loadCustomerAssignments(c.customerId);
  }

  createAssignment() {
    const c = this.selectedCustomer();
    if (!c || !this.canCreate()) return;
    this.assignments
      .create({
        customerId: c.customerId,
        userId: this.formUserId()!,
        assignmentType: 'SALES',
        effectiveFrom: this.formFrom(),
        weekdays: this.formDays(),
      })
      .subscribe(() => {
        this.toast.success('Asignación creada');
        this.formUserId.set(null);
        this.formDays.set([]);
        this.loadCustomerAssignments(c.customerId);
      });
  }

  loadUserAssignments() {
    const id = this.userIdInput();
    if (!id) return;
    this.assignments.byUser(id).subscribe({
      next: (a) => this.userAssignments.set(a),
      error: () => this.userAssignments.set([]),
    });
  }

  endAssignment(a: AssignmentView) {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Cerrar asignación',
          message: `Se cerrará hoy (${this.today()}). ¿Continuar?`,
          confirmText: 'Cerrar',
          danger: true,
        },
        width: '380px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.assignments.end(a.assignmentId, this.today()).subscribe(() => {
          this.toast.success('Asignación cerrada');
          const c = this.selectedCustomer();
          if (this.mode() === 'customer' && c) this.loadCustomerAssignments(c.customerId);
          else this.loadUserAssignments();
        });
      });
  }

  weekdayLabels(days: number[]): string {
    if (!days?.length) return 'Todos';
    return days.map((d) => this.WD[d - 1] ?? d).join(', ');
  }

  private loadCustomerAssignments(id: number) {
    this.assignments.byCustomer(id).subscribe({
      next: (a) => this.custAssignments.set(a),
      error: () => this.custAssignments.set([]),
    });
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
