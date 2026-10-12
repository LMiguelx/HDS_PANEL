import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiTabs, UiTabItem } from '../../shared/ui/tabs/tabs';
import { ToastService } from '../../core/ui/toast';
import { NotificationModuleTabs } from './ui/module-tabs';
import { NotificationAdminService } from './notification-admin';
import {
  AdminNotificationView,
  NotificationListFilters,
} from '../../shared/models/notification.models';
import { notificationTypeName, NOTIFICATION_TYPE_FILTER_OPTIONS } from './notification-format';
import { dateTimeText, timeText } from '../assignments/assignment-format';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Notificaciones → Del equipo — listado de supervisión, sección 9. */
@Component({
  selector: 'app-notifications-team',
  imports: [UiButton, UiField, UiStatus, UiEmpty, UiTabs, NotificationModuleTabs],
  template: `
    <section class="nt-page">
      <app-notification-module-tabs />

      <div class="nt-body">
        <div class="nt-filters">
          <ui-field label="Rol" type="select" [(value)]="roleFilter" [options]="roleOptions()" />
          <ui-field
            label="Usuario"
            type="select"
            [(value)]="userFilter"
            [options]="userOptions()"
          />
          <ui-field label="Tipo" type="select" [(value)]="typeFilter" [options]="typeOptions" />
          <ui-field label="Desde" type="date" [(value)]="fromFilter" />
          <ui-field label="Hasta" type="date" [(value)]="toFilter" />
        </div>

        <ui-tabs [items]="readTabs()" [(value)]="readFilter" />

        @if (loading()) {
          <div class="nt-skeleton" role="status" aria-label="Cargando"></div>
        } @else if (error()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar las notificaciones"
            body="Intenta de nuevo en unos segundos."
            actionLabel="Reintentar"
            (action)="load()"
          />
        } @else if (rows().length === 0) {
          <ui-empty title="No hay notificaciones en este período" />
        } @else {
          <table class="ui-table-grid">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Para</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th>Mensaje</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (n of rows(); track n.notificationId) {
                <tr>
                  <td class="nt-muted">{{ dateTimeText(n.createdAt) }}</td>
                  <td>
                    <button type="button" class="nt-person-link" (click)="filterByPerson(n.userId)">
                      {{ n.userName }}
                    </button>
                    <div class="nt-muted">{{ n.roleNames.join(' · ') }}</div>
                  </td>
                  <td>
                    @if (n.notificationType === 'MANUAL' && n.broadcastId) {
                      <button
                        type="button"
                        class="nt-person-link"
                        (click)="openBroadcast(n.broadcastId)"
                      >
                        {{ typeName(n.notificationType) }}
                      </button>
                    } @else {
                      {{ typeName(n.notificationType) }}
                    }
                  </td>
                  <td class="nt-muted">{{ detailText(n) }}</td>
                  <td>
                    <div
                      class="nt-message"
                      [class.nt-message-open]="expandedId() === n.notificationId"
                      (click)="toggleExpand(n.notificationId)"
                    >
                      {{ n.message }}
                    </div>
                  </td>
                  <td>
                    @if (n.read) {
                      <ui-status label="Leída" status="delivered" />
                      <div class="nt-muted">{{ timeText(n.readAt) }}</div>
                    } @else {
                      <ui-status label="Sin leer" status="partial" />
                      @if (!n.deliveredLive) {
                        <div class="nt-muted">No llegó en vivo</div>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="nt-pager">
            <span class="nt-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
    </section>
  `,
  styles: [
    `
      .nt-page {
        width: 100%;
        box-sizing: border-box;
      }
      .nt-body {
        padding: var(--sp-8);
      }
      .nt-skeleton {
        height: 240px;
        background: var(--faint);
        margin-top: 16px;
      }
      .nt-filters {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 12px;
        margin-bottom: 16px;
      }
      .nt-filters ui-field {
        width: 200px;
      }
      .nt-muted {
        color: var(--ink-muted);
        font-size: 12px;
      }
      .nt-person-link {
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font: inherit;
        font-weight: 800;
        color: var(--ink);
        text-align: left;
      }
      .nt-person-link:hover {
        color: var(--accent);
        text-decoration: underline;
      }
      .nt-message {
        max-width: 360px;
        font-size: 13px;
        cursor: pointer;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .nt-message-open {
        -webkit-line-clamp: unset;
        overflow: visible;
      }
      .nt-pager {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 16px;
      }
      .nt-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
      }

      @media (max-width: 767px) {
        .nt-body {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class NotificationsTeamPage {
  private notificationSvc = inject(NotificationAdminService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected dateTimeText = dateTimeText;
  protected timeText = timeText;
  protected typeName = notificationTypeName;
  protected typeOptions = NOTIFICATION_TYPE_FILTER_OPTIONS;

  protected roleOptions = signal<UiFieldOption[]>([{ value: '', label: 'Todos los roles' }]);
  protected userOptions = signal<UiFieldOption[]>([{ value: '', label: 'Todos' }]);

  protected roleFilter = signal('');
  protected userFilter = signal('');
  protected typeFilter = signal('');
  protected readFilter = signal('');
  protected fromFilter = signal(todayStr());
  protected toFilter = signal(todayStr());
  protected page = signal(0);

  protected loading = signal(true);
  protected error = signal(false);
  protected total = signal(0);
  protected unread = signal(0);
  protected rows = signal<AdminNotificationView[]>([]);
  protected totalPages = signal(0);
  protected expandedId = signal<number | null>(null);

  protected readTabs = computed<UiTabItem[]>(() => [
    { value: '', label: `Todas (${this.total()})` },
    { value: 'false', label: `Sin leer (${this.unread()})` },
    { value: 'true', label: `Leídas (${this.total() - this.unread()})` },
  ]);

  constructor() {
    this.notificationSvc.cachedRoles().subscribe({
      next: (roles) => {
        this.roleOptions.set([
          { value: '', label: 'Todos los roles' },
          ...roles.map((r) => ({ value: r.code, label: `${r.name} (${r.activeUsers})` })),
        ]);
      },
      error: () => undefined,
    });
    this.loadRecipients('');
  }

  /** Cambiar el rol limpia el usuario y vuelve a pedir el selector — sección 9.5. */
  private roleEffect = effect(() => {
    const code = this.roleFilter();
    untracked(() => {
      this.userFilter.set('');
      this.loadRecipients(code);
    });
  });

  private filtersEffect = effect(() => {
    this.roleFilter();
    this.userFilter();
    this.typeFilter();
    this.readFilter();
    this.fromFilter();
    this.toFilter();
    untracked(() => {
      this.page.set(0);
      this.load();
    });
  });

  private loadRecipients(roleCode: string) {
    const recipients$ = roleCode
      ? this.notificationSvc.recipients(roleCode)
      : this.notificationSvc.cachedAllRecipients();
    recipients$.subscribe({
      next: (list) => {
        this.userOptions.set([
          { value: '', label: 'Todos' },
          ...list.map((r) => ({ value: String(r.userId), label: r.fullName })),
        ]);
      },
      error: () => undefined,
    });
  }

  protected filterByPerson(userId: number) {
    this.userFilter.set(String(userId));
  }

  protected openBroadcast(broadcastId: number) {
    this.router.navigate(['/notificaciones/envios'], { queryParams: { broadcastId } });
  }

  protected toggleExpand(id: number) {
    this.expandedId.set(this.expandedId() === id ? null : id);
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

  protected detailText(n: AdminNotificationView): string {
    if (n.notificationType === 'MANUAL') return n.sentByName ? `Enviado por ${n.sentByName}` : '';
    if (n.customerName) return n.invoiceId ? `${n.customerName} · ${n.invoiceId}` : n.customerName;
    return '';
  }

  protected load() {
    this.loading.set(true);
    this.error.set(false);
    const filters: NotificationListFilters = {
      roleCode: this.roleFilter() || undefined,
      userId: this.userFilter() ? Number(this.userFilter()) : undefined,
      type: this.typeFilter() || undefined,
      read: this.readFilter() === '' ? undefined : this.readFilter() === 'true',
      from: this.fromFilter(),
      to: this.toFilter(),
      page: this.page(),
      size: 20,
    };
    this.notificationSvc.list(filters).subscribe({
      next: (res) => {
        this.total.set(res.total);
        this.unread.set(res.unread);
        this.rows.set(res.notifications.content);
        this.totalPages.set(res.notifications.totalPages ?? 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(true);
        this.toast.error(
          err?.error?.detail ?? err?.error?.message ?? 'No pudimos cargar las notificaciones.',
        );
      },
    });
  }
}
