import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { ReasonDialog } from '../../shared/components/reason-dialog';
import { ToastService } from '../../core/ui/toast';
import { CustomerRequestService, RequestType } from './customer-request';
import {
  ClosureRequest,
  CreationRequest,
  FieldChangeRequest,
} from '../../shared/models/customer-request.models';

@Component({
  selector: 'app-approvals',
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Aprobaciones" subtitle="Solicitudes de clientes pendientes" />

      <!-- Tabs propios (sin mat-tabs) -->
      <div class="tabs">
        <button [class.active]="tab() === 'creation'" (click)="tab.set('creation')">
          Creaciones <span class="count">{{ creation().length }}</span>
        </button>
        <button [class.active]="tab() === 'field-change'" (click)="tab.set('field-change')">
          Cambios <span class="count">{{ fieldChange().length }}</span>
        </button>
        <button [class.active]="tab() === 'closure'" (click)="tab.set('closure')">
          Cierres <span class="count">{{ closure().length }}</span>
        </button>
      </div>

      @switch (tab()) {
        @case ('creation') {
          @for (r of creation(); track r.requestId) {
            <mat-card class="req">
              <div class="req-head">
                <div>
                  <strong>{{ r.businessName }}</strong>
                  <p class="muted">{{ r.documentTypeName }} {{ r.documentNumber }}</p>
                </div>
                <span class="muted small"
                  >{{ r.requestedByName }} · {{ r.requestedAt | date: 'dd/MM/yyyy HH:mm' }}</span
                >
              </div>
              <dl>
                <dt>Dirección</dt>
                <dd>{{ r.address ?? '—' }}</dd>
                <dt>Giro</dt>
                <dd>{{ r.businessActivity ?? '—' }}</dd>
                <dt>Teléfono</dt>
                <dd>{{ r.phone ?? '—' }}</dd>
                <dt>Tipo</dt>
                <dd>{{ r.customerTypeName ?? '—' }}</dd>
              </dl>
              <div class="req-actions">
                <button mat-stroked-button (click)="reject('creation', r.requestId)">
                  <mat-icon>close</mat-icon> Rechazar
                </button>
                <button mat-flat-button color="primary" (click)="approve('creation', r.requestId)">
                  <mat-icon>check</mat-icon> Aprobar
                </button>
              </div>
            </mat-card>
          } @empty {
            <p class="muted empty">No hay creaciones pendientes.</p>
          }
        }

        @case ('field-change') {
          @for (r of fieldChange(); track r.requestId) {
            <mat-card class="req">
              <div class="req-head">
                <div>
                  <strong>{{ r.businessName }}</strong>
                  <p class="muted">Cambio de datos</p>
                </div>
                <span class="muted small"
                  >{{ r.requestedByName }} · {{ r.requestedAt | date: 'dd/MM/yyyy HH:mm' }}</span
                >
              </div>
              <table class="changes">
                <tr>
                  <th>Campo</th>
                  <th>Antes</th>
                  <th>Después</th>
                </tr>
                @for (ch of r.changes; track ch.field) {
                  <tr>
                    <td>{{ ch.field }}</td>
                    <td class="muted">{{ ch.oldValue ?? '—' }}</td>
                    <td>
                      <strong>{{ ch.newValue ?? '—' }}</strong>
                    </td>
                  </tr>
                }
              </table>
              <div class="req-actions">
                <button mat-stroked-button (click)="reject('field-change', r.requestId)">
                  <mat-icon>close</mat-icon> Rechazar
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  (click)="approve('field-change', r.requestId)"
                >
                  <mat-icon>check</mat-icon> Aprobar
                </button>
              </div>
            </mat-card>
          } @empty {
            <p class="muted empty">No hay cambios pendientes.</p>
          }
        }

        @case ('closure') {
          @for (r of closure(); track r.requestId) {
            <mat-card class="req">
              <div class="req-head">
                <div>
                  <strong>{{ r.businessName }}</strong>
                  <p class="muted">Cierre de cliente</p>
                </div>
                <span class="muted small"
                  >{{ r.requestedByName }} · {{ r.requestedAt | date: 'dd/MM/yyyy HH:mm' }}</span
                >
              </div>
              <p><span class="muted">Motivo: </span>{{ r.reason ?? '—' }}</p>
              <div class="req-actions">
                <button mat-stroked-button (click)="reject('closure', r.requestId)">
                  <mat-icon>close</mat-icon> Rechazar
                </button>
                <button mat-flat-button color="primary" (click)="approve('closure', r.requestId)">
                  <mat-icon>check</mat-icon> Aprobar
                </button>
              </div>
            </mat-card>
          } @empty {
            <p class="muted empty">No hay cierres pendientes.</p>
          }
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
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tabs button.active {
        color: var(--mat-sys-primary);
        border-bottom-color: var(--mat-sys-primary);
        font-weight: 600;
      }
      .count {
        background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent);
        color: var(--mat-sys-primary);
        border-radius: 999px;
        padding: 0 8px;
        font-size: 0.78rem;
        font-weight: 600;
      }
      .req {
        padding: 16px;
        margin-bottom: 12px;
        max-width: 720px;
      }
      .req-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 10px;
      }
      .req-head p {
        margin: 2px 0 0;
      }
      .small {
        font-size: 0.8rem;
        white-space: nowrap;
      }
      dl {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 4px 12px;
        margin: 0 0 12px;
      }
      dt {
        color: var(--mat-sys-on-surface-variant);
      }
      dd {
        margin: 0;
      }
      .changes {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
      }
      .changes th,
      .changes td {
        text-align: left;
        padding: 6px 8px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .changes th {
        font-size: 0.78rem;
        color: var(--mat-sys-on-surface-variant);
        font-weight: 600;
      }
      .req-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .empty {
        padding: 24px 0;
      }
    `,
  ],
})
export class ApprovalsPage {
  private reqs = inject(CustomerRequestService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly tab = signal<RequestType>('creation');
  readonly creation = signal<CreationRequest[]>([]);
  readonly fieldChange = signal<FieldChangeRequest[]>([]);
  readonly closure = signal<ClosureRequest[]>([]);

  constructor() {
    this.refresh('creation');
    this.refresh('field-change');
    this.refresh('closure');
  }

  approve(type: RequestType, id: number) {
    this.dialog
      .open(ConfirmDialog, {
        data: { title: '¿Aprobar solicitud?', confirmText: 'Aprobar' },
        width: '380px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.reqs.approve(type, id).subscribe(() => {
          this.toast.success('Solicitud aprobada');
          this.refresh(type);
        });
      });
  }

  reject(type: RequestType, id: number) {
    this.dialog
      .open(ReasonDialog, {
        data: { title: 'Rechazar solicitud', label: 'Motivo del rechazo' },
        width: '420px',
      })
      .afterClosed()
      .subscribe((reason?: string) => {
        if (!reason) return;
        this.reqs.reject(type, id, reason).subscribe(() => {
          this.toast.success('Solicitud rechazada');
          this.refresh(type);
        });
      });
  }

  private refresh(type: RequestType) {
    if (type === 'creation') {
      this.reqs.pendingCreation().subscribe({ next: (r) => this.creation.set(r), error: () => {} });
    } else if (type === 'field-change') {
      this.reqs
        .pendingFieldChange()
        .subscribe({ next: (r) => this.fieldChange.set(r), error: () => {} });
    } else {
      this.reqs.pendingClosure().subscribe({ next: (r) => this.closure.set(r), error: () => {} });
    }
  }
}
