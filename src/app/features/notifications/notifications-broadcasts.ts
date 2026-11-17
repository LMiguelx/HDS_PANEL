import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiCard } from '../../shared/ui/card/card';
import { UiTabs, UiTabItem } from '../../shared/ui/tabs/tabs';
import { ToastService } from '../../core/ui/toast';
import { AuthService } from '../../core/auth/auth';
import { NotificationModuleTabs } from './ui/module-tabs';
import { NotificationAdminService } from './notification-admin';
import {
  BroadcastDetail,
  BroadcastRecipientView,
  BroadcastSummary,
} from '../../shared/models/notification.models';
import { dateTimeText, timeText } from '../assignments/assignment-format';

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Notificaciones → Envíos — historial de envíos manuales, sección 11. */
@Component({
  selector: 'app-notifications-broadcasts',
  imports: [UiButton, UiField, UiStatus, UiEmpty, UiCard, UiTabs, NotificationModuleTabs],
  template: `
    <section class="nbr-page">
      <app-notification-module-tabs />

      <div class="nbr-body">
        <div class="nbr-grid">
          <div class="nbr-list">
            <div class="nbr-filters">
              <ui-field label="Desde" type="date" [(value)]="fromFilter" />
              <ui-field label="Hasta" type="date" [(value)]="toFilter" />
            </div>

            @if (loading()) {
              <div class="nbr-skeleton" role="status" aria-label="Cargando"></div>
            } @else if (error()) {
              <ui-empty
                variant="error"
                title="No pudimos cargar los envíos"
                body="Intenta de nuevo en unos segundos."
                actionLabel="Reintentar"
                (action)="load()"
              />
            } @else if (rows().length === 0) {
              <ui-empty
                title="No se han enviado mensajes en este período"
                [actionLabel]="canSend() ? 'Nuevo envío' : ''"
                (action)="goToNewBroadcast()"
              />
            } @else {
              @for (b of rows(); track b.broadcastId) {
                <button
                  type="button"
                  class="nbr-row"
                  [class.nbr-row-active]="selectedId() === b.broadcastId"
                  (click)="selectedId.set(b.broadcastId)"
                >
                  <div class="nbr-row-head">
                    <span class="nbr-muted">{{ dateTimeText(b.createdAt) }}</span>
                    <span class="nbr-progress" [class.nbr-progress-done]="b.unread === 0">
                      {{ b.read }} / {{ b.recipients }}
                    </span>
                  </div>
                  <div class="nbr-row-message">{{ b.message }}</div>
                  <div class="nbr-muted">{{ targetsText(b) }}</div>
                </button>
              }

              <div class="nbr-pager">
                <span class="nbr-pager-label"
                  >Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span
                >
                <button uiButton variant="secondary" [disabled]="page() === 0" (click)="prevPage()">
                  Anterior
                </button>
                <button
                  uiButton
                  variant="secondary"
                  [disabled]="page() + 1 >= totalPages()"
                  (click)="nextPage()"
                >
                  Siguiente
                </button>
              </div>
            }
          </div>

          <div class="nbr-detail">
            @if (selectedId() == null) {
              <ui-empty title="Elige un envío para ver su detalle" />
            } @else if (loadingDetail()) {
              <div class="nbr-skeleton" role="status" aria-label="Cargando"></div>
            } @else if (errorDetail()) {
              <ui-empty
                variant="error"
                title="No pudimos cargar el envío"
                actionLabel="Reintentar"
                (action)="loadDetail(selectedId()!)"
              />
            } @else if (detail(); as d) {
              <ui-card [title]="'Envío del ' + dateTimeText(d.createdAt) + ' · ' + d.sentByName">
                <p class="nbr-detail-message">{{ d.message }}</p>
                <p class="nbr-muted">Para: {{ targetsText(d) }}</p>
                <p class="nbr-summary-line">
                  {{ d.recipients }} destinatarios · {{ d.read }} leyeron · {{ d.unread }} faltan
                </p>

                @if (d.unread === 0) {
                  <p class="nbr-all-read">Todos leyeron este mensaje.</p>
                }

                <div class="nbr-detail-actions">
                  <ui-tabs [items]="recipientTabs()" [(value)]="recipientFilter" />
                  <button
                    uiButton
                    variant="secondary"
                    size="sm"
                    (click)="loadDetail(d.broadcastId)"
                  >
                    Actualizar
                  </button>
                </div>

                <table class="ui-table-grid">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Aviso</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of filteredRecipients(); track r.notificationId) {
                      <tr>
                        <td class="nbr-cell-strong">{{ r.userName }}</td>
                        <td class="nbr-muted">{{ r.roleNames.join(', ') }}</td>
                        <td>
                          @if (r.read) {
                            <ui-status label="Leída {{ timeText(r.readAt) }}" status="delivered" />
                          } @else {
                            <ui-status label="Sin leer" status="partial" />
                          }
                        </td>
                        <td class="nbr-muted">
                          @if (!r.read && !r.deliveredLive) {
                            No le llegó en vivo
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </ui-card>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .nbr-page {
        width: 100%;
        box-sizing: border-box;
      }
      .nbr-body {
        padding: var(--sp-8);
      }
      .nbr-grid {
        display: grid;
        grid-template-columns: 420px 1fr;
        gap: 20px;
        align-items: start;
      }
      .nbr-filters {
        display: flex;
        gap: 12px;
        margin-bottom: 14px;
      }
      .nbr-skeleton {
        height: 200px;
        background: var(--faint);
      }
      .nbr-list {
        display: flex;
        flex-direction: column;
      }
      .nbr-row {
        appearance: none;
        background: var(--surface);
        border: 1px solid var(--hairline);
        border-top: 0;
        width: 100%;
        text-align: left;
        padding: 12px 14px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .nbr-row:first-of-type {
        border-top: 1px solid var(--hairline);
      }
      .nbr-row:hover {
        background: var(--faint);
      }
      .nbr-row-active {
        border-color: var(--accent);
        background: var(--accent-wash);
      }
      .nbr-row-head {
        display: flex;
        justify-content: space-between;
      }
      .nbr-row-message {
        font-weight: 700;
        color: var(--ink);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .nbr-muted {
        color: var(--ink-muted);
        font-size: 12px;
      }
      .nbr-progress {
        font-size: 12px;
        font-weight: 700;
        color: var(--ink-muted);
      }
      .nbr-progress-done {
        color: var(--success);
      }
      .nbr-pager {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 16px;
      }
      .nbr-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .nbr-detail-message {
        font-size: 15px;
        color: var(--ink);
      }
      .nbr-summary-line {
        font-size: 13px;
        font-weight: 700;
      }
      .nbr-all-read {
        color: var(--success);
        font-weight: 700;
      }
      .nbr-detail-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 10px 0;
      }
      .nbr-cell-strong {
        font-weight: 800;
      }

      @media (max-width: 900px) {
        .nbr-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .nbr-body {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class NotificationsBroadcastsPage {
  private notificationSvc = inject(NotificationAdminService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private auth = inject(AuthService);

  /** Query param ?broadcastId= — ligado por withComponentInputBinding, igual que `id` en delivery-batch-detail.ts. */
  broadcastId = input('');

  protected canSend = computed(() => this.auth.hasAny('notification.send'));

  protected dateTimeText = dateTimeText;
  protected timeText = timeText;

  protected fromFilter = signal(daysAgoStr(30));
  protected toFilter = signal(todayStr());
  protected page = signal(0);
  protected totalPages = signal(0);
  protected loading = signal(true);
  protected error = signal(false);
  protected rows = signal<BroadcastSummary[]>([]);

  protected selectedId = signal<number | null>(null);
  protected loadingDetail = signal(false);
  protected errorDetail = signal(false);
  protected detail = signal<BroadcastDetail | null>(null);
  protected recipientFilter = signal('');

  protected recipientTabs = computed<UiTabItem[]>(() => {
    const list = this.detail()?.recipientList ?? [];
    const unread = list.filter((r) => !r.read).length;
    return [
      { value: '', label: `Todos (${list.length})` },
      { value: 'false', label: `Sin leer (${unread})` },
      { value: 'true', label: `Leídas (${list.length - unread})` },
    ];
  });

  protected filteredRecipients = computed<BroadcastRecipientView[]>(() => {
    const list = this.detail()?.recipientList ?? [];
    const filter = this.recipientFilter();
    if (filter === '') return list;
    const wantRead = filter === 'true';
    return list.filter((r) => r.read === wantRead);
  });

  private filtersEffect = effect(() => {
    this.fromFilter();
    this.toFilter();
    this.page.set(0);
    this.load();
  });

  private selectedEffect = effect(() => {
    const id = this.selectedId();
    if (id != null) this.loadDetail(id);
  });

  private broadcastIdInputEffect = effect(() => {
    const raw = this.broadcastId();
    if (raw) this.selectedId.set(Number(raw));
  });

  protected targetsText(b: { targets: { name: string }[] }): string {
    const names = b.targets.map((t) => t.name);
    if (names.length <= 3) return names.join(' · ');
    return `${names.slice(0, 3).join(' · ')} +${names.length - 3}`;
  }

  protected goToNewBroadcast() {
    this.router.navigate(['/notificaciones/nuevo']);
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.load();
  }

  protected nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set(false);
    this.notificationSvc
      .broadcasts({ from: this.fromFilter(), to: this.toFilter(), page: this.page(), size: 20 })
      .subscribe({
        next: (res) => {
          this.rows.set(res.content);
          this.totalPages.set(res.totalPages ?? 0);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(true);
          this.toast.error(
            err?.error?.detail ?? err?.error?.message ?? 'No pudimos cargar los envíos.',
          );
        },
      });
  }

  protected loadDetail(broadcastId: number) {
    this.loadingDetail.set(true);
    this.errorDetail.set(false);
    this.recipientFilter.set('');
    this.notificationSvc.broadcastDetail(broadcastId).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loadingDetail.set(false);
      },
      error: (err) => {
        this.loadingDetail.set(false);
        this.errorDetail.set(true);
        this.toast.error(
          err?.error?.detail ?? err?.error?.message ?? 'No pudimos cargar el envío.',
        );
      },
    });
  }
}
