import { Component, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { RequestModuleTabs } from './ui/module-tabs';
import { LookupService, toUiLookup } from '../promos/lookup';
import { CustomerRequestAdminService } from './customer-request-admin';
import { CreationRequestDetail, RequestView } from '../../shared/models/customer-request.models';
import { customerTypeName, documentTypeName } from './request-format';
import { dateTimeText } from '../assignments/assignment-format';

const WEEKDAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

/**
 * Solicitudes de creación — listado + panel de detalle al costado (doc 31,
 * secciones 5-7). El código de cliente ya no lo escribe el supervisor: lo
 * asigna el ERP y solo se puede aprobar cuando `erpRegistered` es true.
 */
@Component({
  selector: 'app-request-creation',
  imports: [UiButton, UiStatus, UiEmpty, UiTypeahead, RequestModuleTabs],
  template: `
    <app-request-module-tabs />
    <section class="rc-page">
      <div class="rc-head">
        <div>
          <h1>Solicitudes de creación</h1>
          <p class="rc-sub">{{ countText() }}</p>
        </div>
        <button uiButton variant="secondary" [loading]="loading()" (click)="refresh()">
          Actualizar
        </button>
      </div>

      <div class="rc-split" [class.detail-open]="selectedId() !== null">
        <div class="rc-list">
          @if (loading()) {
            <div class="rc-skeleton" role="status" aria-label="Cargando"></div>
          } @else if (error()) {
            <ui-empty
              variant="error"
              title="No pudimos cargar las solicitudes"
              body="Intenta de nuevo en unos segundos."
              actionLabel="Reintentar"
              (action)="load()"
            />
          } @else if (rows().length === 0) {
            <ui-empty
              variant="al-dia"
              eyebrow="Al día"
              title="Sin solicitudes de creación pendientes"
              body="Cuando un vendedor pida crear un cliente nuevo, aparece acá."
            />
          } @else {
            @for (r of rows(); track r.requestId) {
              <button
                type="button"
                class="rc-row"
                [class.selected]="r.requestId === selectedId()"
                (click)="select(r.requestId)"
              >
                <div class="rc-row-top">
                  <span class="rc-row-name">{{ r.businessName }}</span>
                  @if (r.erpRegistered) {
                    <ui-status label="Lista" status="vigente" />
                  } @else {
                    <ui-status label="Esperando ERP" status="pendiente" />
                  }
                </div>
                <div class="rc-row-bottom">
                  <span class="rc-muted"
                    >{{ r.requestedByName }} · {{ dateTimeText(r.createdAt) }}</span
                  >
                  <span class="rc-row-code">
                    @if (r.erpRegistered) {
                      {{ r.customerCode }} · Sec. {{ r.routeSequence }}
                    } @else {
                      —
                    }
                  </span>
                </div>
              </button>
            }
          }
        </div>

        <div class="rc-detail-panel">
          @if (selectedId() === null) {
            <ui-empty title="Elige una solicitud" body="Selecciona una fila para revisarla." />
          } @else {
            <button type="button" class="rc-back" (click)="selectedId.set(null)">
              ← Volver al listado
            </button>

            @if (detailLoading()) {
              <div class="rc-skeleton" role="status" aria-label="Cargando"></div>
            } @else if (detailError()) {
              <ui-empty
                variant="error"
                title="No pudimos cargar la solicitud"
                body="Intenta de nuevo en unos segundos."
                actionLabel="Reintentar"
                (action)="loadDetail()"
              />
            } @else if (detail(); as d) {
              <div class="rc-detail-head">
                <h2>{{ d.businessName }}</h2>
                @if (d.erpRegistered) {
                  <ui-status label="Lista para aprobar" status="vigente" />
                } @else {
                  <ui-status label="Esperando ERP" status="pendiente" />
                }
              </div>

              <h3 class="rc-block-title">Datos de la solicitud</h3>
              <div class="rc-fields">
                <div class="rc-field">
                  <span class="rc-field-label">Documento</span>
                  <span class="rc-field-value">
                    @if (d.documentNumber) {
                      {{ documentTypeName(d.documentTypeId) }} {{ d.documentNumber }}
                    } @else {
                      —
                    }
                  </span>
                </div>
                <div class="rc-field">
                  <span class="rc-field-label">Tipo de cliente</span>
                  <span class="rc-field-value">
                    @if (d.customerTypeId == null) {
                      <span class="rc-warn">Sin tipo</span>
                    } @else {
                      {{ customerTypeName(d.customerTypeId) }}
                    }
                  </span>
                </div>
                <div class="rc-field">
                  <span class="rc-field-label">Dirección</span>
                  <span class="rc-field-value">{{ d.address || '—' }}</span>
                </div>
                <div class="rc-field">
                  <span class="rc-field-label">Actividad</span>
                  <span class="rc-field-value">{{ d.businessActivity || '—' }}</span>
                </div>
                <div class="rc-field">
                  <span class="rc-field-label">Teléfono</span>
                  <span class="rc-field-value">{{ d.phone || '—' }}</span>
                </div>
                <div class="rc-field">
                  <span class="rc-field-label">Ubicación</span>
                  <span class="rc-field-value">{{
                    d.latitude != null && d.longitude != null ? 'Con GPS' : 'Sin GPS'
                  }}</span>
                </div>
                <div class="rc-field">
                  <span class="rc-field-label">Solicitó</span>
                  <span class="rc-field-value"
                    >{{ d.requestedByName }} · {{ dateTimeText(d.createdAt) }}</span
                  >
                </div>
              </div>

              <h3 class="rc-block-title">Registro en el ERP</h3>
              @if (d.erpRegistered) {
                <div class="rc-fields">
                  <div class="rc-field">
                    <span class="rc-field-label">Código</span>
                    <span class="rc-field-value rc-mono">{{ d.customerCode }}</span>
                  </div>
                  <div class="rc-field">
                    <span class="rc-field-label">Secuencia de ruta</span>
                    <span class="rc-field-value">{{ d.routeSequence }}</span>
                  </div>
                  <div class="rc-field">
                    <span class="rc-field-label">Registrado</span>
                    <span class="rc-field-value">{{ dateTimeText(d.erpRegisteredAt) }}</span>
                  </div>
                </div>
              } @else {
                <p class="rc-muted">
                  El ERP todavía no registra a este cliente. El código y la secuencia de ruta
                  aparecerán aquí.
                </p>
              }

              <h3 class="rc-block-title">Asignación</h3>
              <div class="rc-assign" [class.rc-disabled]="!d.erpRegistered">
                <ui-typeahead
                  label="Vendedor"
                  [clearOnPick]="false"
                  [disabled]="!d.erpRegistered"
                  [search]="userSearch"
                  [(selected)]="vendor"
                />
                <div class="rc-weekdays">
                  <span class="rc-field-label">Días de visita</span>
                  <div class="rc-chips">
                    @for (day of weekdays; track day.value) {
                      <button
                        type="button"
                        class="rc-chip"
                        [class.on]="weekdaysValue().includes(day.value)"
                        [disabled]="!d.erpRegistered"
                        (click)="toggleWeekday(day.value)"
                      >
                        {{ day.label }}
                      </button>
                    }
                  </div>
                </div>
              </div>

              @if (actionError()) {
                <div class="rc-error">{{ actionError() }}</div>
              }

              <div class="rc-actions">
                <button uiButton variant="ghost" [loading]="rejecting()" (click)="reject(d)">
                  Rechazar
                </button>
                <button
                  uiButton
                  variant="primary"
                  [disabled]="!d.erpRegistered"
                  [title]="
                    d.erpRegistered
                      ? ''
                      : 'No se puede aprobar hasta que el ERP registre la solicitud.'
                  "
                  [loading]="approving()"
                  (click)="approve(d)"
                >
                  Aprobar y crear
                </button>
              </div>
            }
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .rc-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .rc-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 20px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .rc-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .rc-split {
        display: grid;
        grid-template-columns: 0.82fr 1fr;
        border: 1px solid var(--hairline);
        min-height: 420px;
      }
      .rc-list {
        border-right: 1px solid var(--hairline);
        overflow-y: auto;
        max-height: 70vh;
      }
      .rc-skeleton {
        height: 200px;
        background: var(--faint);
      }
      .rc-row {
        display: block;
        width: 100%;
        text-align: left;
        font-family: var(--font-sans);
        background: var(--bg);
        border: 0;
        border-bottom: 1px solid var(--hairline);
        border-left: 3px solid transparent;
        padding: 12px 16px;
        cursor: pointer;
      }
      .rc-row:hover {
        background: var(--faint);
      }
      .rc-row.selected {
        background: var(--faint);
        border-left-color: var(--accent);
      }
      .rc-row-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .rc-row-name {
        font-weight: 800;
        font-size: 14px;
        color: var(--ink);
      }
      .rc-row-bottom {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        margin-top: 4px;
      }
      .rc-row-code {
        font-size: 12px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .rc-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .rc-detail-panel {
        padding: 20px 24px;
        overflow-y: auto;
        max-height: 70vh;
      }
      .rc-back {
        display: none;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        color: var(--accent-ink);
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 0 0 14px;
      }
      .rc-detail-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .rc-detail-head h2 {
        margin: 0;
        font: var(--fw-h1) var(--fs-h1) / var(--lh-h1) var(--font-sans);
        color: var(--ink);
      }
      .rc-block-title {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        margin: 22px 0 10px;
        padding-top: 14px;
        border-top: 1px solid var(--hairline);
      }
      .rc-block-title:first-of-type {
        margin-top: 0;
        padding-top: 0;
        border-top: 0;
      }
      .rc-fields {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 12px;
      }
      .rc-field {
        display: grid;
        gap: 2px;
      }
      .rc-field-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .rc-field-value {
        font-size: 14px;
        color: var(--ink);
      }
      .rc-mono {
        font-family: monospace;
        font-weight: 700;
      }
      .rc-warn {
        color: var(--st-pendiente);
        font-weight: 700;
      }
      .rc-assign {
        display: grid;
        gap: 14px;
      }
      .rc-disabled {
        opacity: 0.55;
      }
      .rc-weekdays {
        display: grid;
        gap: 6px;
      }
      .rc-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .rc-chip {
        appearance: none;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        border: 1px solid var(--divider);
        background: transparent;
        color: var(--ink);
        min-height: 36px;
        padding: 0 14px;
      }
      .rc-chip:hover:not(:disabled) {
        background: var(--faint);
      }
      .rc-chip:disabled {
        cursor: not-allowed;
      }
      .rc-chip.on {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--on-accent);
      }
      .rc-error {
        margin-top: 14px;
        color: var(--accent-ink);
        font-size: 13px;
      }
      .rc-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--hairline);
      }

      @media (max-width: 1199px) {
        .rc-split {
          grid-template-columns: 1fr;
        }
        .rc-split.detail-open .rc-list {
          display: none;
        }
        .rc-split:not(.detail-open) .rc-detail-panel {
          display: none;
        }
        .rc-back {
          display: block;
        }
        .rc-list,
        .rc-detail-panel {
          max-height: none;
        }
      }

      @media (max-width: 767px) {
        .rc-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class RequestCreationPage {
  private requestSvc = inject(CustomerRequestAdminService);
  private lookupSvc = inject(LookupService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected dateTimeText = dateTimeText;
  protected documentTypeName = documentTypeName;
  protected customerTypeName = customerTypeName;
  protected weekdays = WEEKDAYS;
  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

  protected rows = signal<RequestView[]>([]);
  protected totalElements = signal(0);
  protected loading = signal(true);
  protected error = signal(false);

  protected selectedId = signal<number | null>(null);
  protected detail = signal<CreationRequestDetail | null>(null);
  protected detailLoading = signal(false);
  protected detailError = signal(false);

  protected vendor = signal<UiLookupItem | null>(null);
  protected weekdaysValue = signal<number[]>([]);
  protected approving = signal(false);
  protected rejecting = signal(false);
  protected actionError = signal('');

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 solicitud pendiente' : `${n} solicitudes pendientes`;
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.requestSvc.pendingCreation({ page: 0, size: 100 }).subscribe({
      next: (result) => {
        this.rows.set(result.content ?? []);
        this.totalElements.set(result.totalElements ?? 0);
        this.loading.set(false);
        if (this.selectedId() === null && this.rows().length > 0) {
          this.select(this.rows()[0].requestId);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  /** Vuelve a pedir el listado y, si hay una solicitud abierta, su detalle — el ERP puede registrarla en cualquier momento. */
  protected refresh() {
    this.loading.set(true);
    this.error.set(false);
    const openId = this.selectedId();
    forkJoin({
      list: this.requestSvc.pendingCreation({ page: 0, size: 100 }),
      detail: openId ? this.requestSvc.creationDetail(openId) : Promise.resolve(null),
    }).subscribe({
      next: ({ list, detail }) => {
        this.rows.set(list.content ?? []);
        this.totalElements.set(list.totalElements ?? 0);
        this.loading.set(false);
        if (detail) this.detail.set(detail);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected select(requestId: number) {
    this.selectedId.set(requestId);
    this.actionError.set('');
    this.loadDetail();
  }

  protected loadDetail() {
    const id = this.selectedId();
    if (!id) return;
    this.detailLoading.set(true);
    this.detailError.set(false);
    this.detail.set(null);
    this.requestSvc.creationDetail(id).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.detailLoading.set(false);
        this.vendor.set({ id: detail.requestedBy, name: detail.requestedByName });
        this.weekdaysValue.set([]);
      },
      error: () => {
        this.detailLoading.set(false);
        this.detailError.set(true);
      },
    });
  }

  protected toggleWeekday(value: number) {
    const current = this.weekdaysValue();
    this.weekdaysValue.set(
      current.includes(value)
        ? current.filter((d) => d !== value)
        : [...current, value].sort((a, b) => a - b),
    );
  }

  /** Quita la solicitud resuelta del listado y pasa a la siguiente — sección 2.4. */
  private afterResolved(requestId: number) {
    this.rows.update((list) => list.filter((r) => r.requestId !== requestId));
    this.totalElements.update((n) => Math.max(0, n - 1));
    const next = this.rows()[0];
    if (next) {
      this.select(next.requestId);
    } else {
      this.selectedId.set(null);
      this.detail.set(null);
    }
  }

  protected approve(d: CreationRequestDetail) {
    const vendorName = this.vendor()?.name || d.requestedByName;
    const confirmWeekdaysNote = this.weekdaysValue().length === 0;
    this.dialog
      .confirm({
        title: 'Aprobar y crear cliente',
        message: confirmWeekdaysNote
          ? `¿Crear al cliente ${d.businessName} con el código ${d.customerCode}, asignado a ${vendorName}? El cliente se creará sin días de visita.`
          : `¿Crear al cliente ${d.businessName} con el código ${d.customerCode}, asignado a ${vendorName}?`,
        confirmLabel: 'Aprobar y crear',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.approving.set(true);
        this.actionError.set('');
        this.requestSvc
          .approveCreation(d.requestId, {
            userId: this.vendor()?.id !== d.requestedBy ? this.vendor()?.id : undefined,
            weekdays: this.weekdaysValue().length ? this.weekdaysValue() : undefined,
          })
          .subscribe({
            next: () => {
              this.approving.set(false);
              this.toast.success(`Cliente creado con el código ${d.customerCode}.`);
              this.afterResolved(d.requestId);
            },
            error: (err) => {
              this.approving.set(false);
              const detalle = err?.error?.detail ?? err?.error?.message;
              this.actionError.set(detalle || 'No pudimos aprobar la solicitud.');
            },
          });
      });
  }

  protected reject(d: CreationRequestDetail) {
    this.dialog
      .confirm({
        title: 'Rechazar solicitud',
        message: `¿Rechazar la solicitud de ${d.businessName}? No se creará el cliente.`,
        confirmLabel: 'Rechazar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.rejecting.set(true);
        this.actionError.set('');
        this.requestSvc.reject('creation', d.requestId).subscribe({
          next: () => {
            this.rejecting.set(false);
            this.afterResolved(d.requestId);
          },
          error: (err) => {
            this.rejecting.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.actionError.set(detalle || 'No pudimos rechazar la solicitud.');
          },
        });
      });
  }
}
