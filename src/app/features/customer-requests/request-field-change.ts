import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiCard } from '../../shared/ui/card/card';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { RequestModuleTabs } from './ui/module-tabs';
import { CustomerRequestAdminService } from './customer-request-admin';
import { FieldChangeGroupView } from '../../shared/models/customer-request.models';
import { dateTimeText } from '../assignments/assignment-format';

const FIELD_LABELS: Record<string, string> = {
  businessName: 'Razón social',
  address: 'Dirección',
  phone: 'Teléfono',
  businessActivity: 'Actividad',
  documentNumber: 'Documento',
};

/** Grupos de cambio de campo pendientes — cada grupo se aprueba o rechaza completo. */
@Component({
  selector: 'app-request-field-change',
  imports: [UiButton, UiCard, UiEmpty, RequestModuleTabs],
  template: `
    <app-request-module-tabs />
    <section class="rfc-page">
      <div class="rfc-head">
        <h1>Cambios de campo</h1>
        <p class="rfc-sub">{{ countText() }}</p>
      </div>

      @if (loading()) {
        <div class="rfc-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar los cambios pendientes"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (groups().length === 0) {
        <ui-empty
          variant="al-dia"
          eyebrow="Al día"
          title="Sin cambios de campo pendientes"
          body="Cuando un vendedor pida cambiar datos de un cliente, aparece acá."
        />
      } @else {
        <div class="rfc-grid">
          @for (g of groups(); track g.groupId) {
            <ui-card variant="work" [saving]="resolvingId() === g.groupId">
              <div class="rfc-card-head">
                <div>
                  <div class="rfc-card-customer">{{ g.businessName }}</div>
                  <div class="rfc-card-meta">
                    {{ g.requestedByName }} · {{ dateTimeText(g.createdAt) }}
                  </div>
                </div>
              </div>
              @if (g.reason) {
                <div class="rfc-card-reason">{{ g.reason }}</div>
              }
              <div class="rfc-changes">
                @for (change of g.changes; track change.requestId) {
                  <div class="rfc-change-row">
                    <span class="rfc-change-field">{{ fieldLabel(change.fieldName) }}</span>
                    <span class="rfc-change-value">{{ change.newValue }}</span>
                  </div>
                }
              </div>
              <div class="rfc-card-actions">
                <button
                  uiButton
                  variant="primary"
                  size="sm"
                  [disabled]="resolvingId() === g.groupId"
                  (click)="approve(g)"
                >
                  Aprobar todo
                </button>
                <button
                  uiButton
                  variant="ghost"
                  size="sm"
                  [disabled]="resolvingId() === g.groupId"
                  (click)="reject(g)"
                >
                  Rechazar
                </button>
              </div>
            </ui-card>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .rfc-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .rfc-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .rfc-skeleton {
        height: 200px;
        background: var(--faint);
        margin-top: 20px;
      }
      .rfc-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr));
        gap: 18px;
        margin-top: 20px;
      }
      .rfc-card-customer {
        font-weight: 800;
        font-size: 16px;
        color: var(--ink);
      }
      .rfc-card-meta {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .rfc-card-reason {
        margin-top: 10px;
        font-size: 13px;
        color: var(--ink-muted);
        font-style: italic;
      }
      .rfc-changes {
        margin-top: 12px;
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .rfc-change-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        background: var(--bg);
        padding: 8px 10px;
        font-size: 13px;
      }
      .rfc-change-field {
        color: var(--ink-muted);
      }
      .rfc-change-value {
        font-weight: 600;
        color: var(--ink);
        text-align: right;
      }
      .rfc-card-actions {
        display: flex;
        gap: 8px;
        margin-top: 14px;
      }

      @media (max-width: 767px) {
        .rfc-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class RequestFieldChangePage {
  private requestSvc = inject(CustomerRequestAdminService);
  private dialog = inject(UiDialogService);

  protected dateTimeText = dateTimeText;

  protected groups = signal<FieldChangeGroupView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected resolvingId = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.groups().length;
    if (n === 0) return 'Sin pendientes.';
    return n === 1 ? '1 cambio pendiente' : `${n} cambios pendientes`;
  }

  protected fieldLabel(fieldName: string): string {
    return FIELD_LABELS[fieldName] ?? fieldName;
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.requestSvc.pendingFieldChange().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected approve(g: FieldChangeGroupView) {
    this.dialog
      .confirm({
        title: 'Aprobar cambios',
        message: `¿Aplicar los ${g.changes.length} cambios pedidos para "${g.businessName}"?`,
        confirmLabel: 'Aprobar todo',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.resolvingId.set(g.groupId);
        this.requestSvc.approveFieldChange(g.groupId).subscribe({
          next: () => {
            this.resolvingId.set(null);
            this.load();
          },
          error: () => this.resolvingId.set(null),
        });
      });
  }

  protected reject(g: FieldChangeGroupView) {
    this.dialog
      .confirm({
        title: 'Rechazar cambios',
        message: `¿Rechazar el grupo completo de cambios para "${g.businessName}"?`,
        confirmLabel: 'Rechazar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.resolvingId.set(g.groupId);
        this.requestSvc.rejectFieldChange(g.groupId).subscribe({
          next: () => {
            this.resolvingId.set(null);
            this.load();
          },
          error: () => this.resolvingId.set(null),
        });
      });
  }
}
