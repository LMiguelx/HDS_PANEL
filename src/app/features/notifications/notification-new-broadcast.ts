import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiCard } from '../../shared/ui/card/card';
import { UiCheckbox } from '../../shared/ui/checkbox/checkbox';
import { UiBadge } from '../../shared/ui/badge/badge';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { AuthService } from '../../core/auth/auth';
import { NotificationModuleTabs } from './ui/module-tabs';
import { NotificationAdminService } from './notification-admin';
import { RecipientRoleView, RecipientView } from '../../shared/models/notification.models';
import { BROADCAST_EXCLUDED_ROLE_CODES } from './notification-format';

const MAX_MESSAGE_LENGTH = 400;

/** Notificaciones → Nuevo envío — envío manual, sección 10 (diseño: doc 38, sección 9). */
@Component({
  selector: 'app-notification-new-broadcast',
  imports: [
    UiButton,
    UiField,
    UiCard,
    UiCheckbox,
    UiBadge,
    UiEmpty,
    UiTypeahead,
    NotificationModuleTabs,
  ],
  template: `
    <section class="nb-page">
      <app-notification-module-tabs />

      <div class="nb-body">
        @if (loading()) {
          <div class="nb-skeleton" role="status" aria-label="Cargando"></div>
        } @else if (loadError()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar los catálogos de envío"
            body="Intenta de nuevo en unos segundos."
            actionLabel="Reintentar"
            (action)="loadCatalogs()"
          />
        } @else {
          <div class="nb-grid">
            <div class="nb-main">
              <ui-card title="Mensaje">
                <ui-field
                  label="Mensaje *"
                  type="textarea"
                  [rows]="5"
                  [(value)]="message"
                  [hint]="messageLength() + ' / ' + maxLength"
                  [error]="messageLength() > maxLength ? 'Pasa de 400 caracteres' : ''"
                />
              </ui-card>

              <ui-card title="Para">
                <p class="nb-label">Roles</p>
                <div class="nb-roles">
                  @for (r of availableRoles(); track r.code) {
                    <ui-checkbox
                      [label]="r.name"
                      [disabled]="r.activeUsers === 0"
                      [checked]="selectedRoleCodes().has(r.code)"
                      (checkedChange)="toggleRole(r.code)"
                    >
                      <ui-badge trailing tone="neutral">{{ r.activeUsers }}</ui-badge>
                    </ui-checkbox>
                  }
                </div>

                <p class="nb-label">Personas</p>
                <ui-typeahead
                  label=""
                  placeholder="Buscar persona…"
                  [clearOnPick]="true"
                  [search]="searchPeople"
                  (picked)="addPerson($event)"
                />
                @if (pickedUsers().length > 0) {
                  <div class="nb-chips">
                    @for (u of pickedUsers(); track u.userId) {
                      <span class="nb-chip" [title]="u.fullName + ' · ' + u.roleNames.join(', ')">
                        <span class="nb-chip-text"
                          >{{ u.fullName }} · {{ u.roleNames.join(', ') }}</span
                        >
                        <button
                          type="button"
                          [attr.aria-label]="'Quitar ' + u.fullName"
                          (click)="removePerson(u.userId)"
                        >
                          ✕
                        </button>
                      </span>
                    }
                  </div>
                }
              </ui-card>
            </div>

            <div class="nb-side">
              <ui-card title="Recibirán el mensaje">
                <p class="nb-preview-count">
                  {{ previewCount() }} persona{{ previewCount() === 1 ? '' : 's' }}
                </p>
                @for (r of selectedRoleRows(); track r.code) {
                  <div class="nb-preview-row">
                    <span>{{ r.name }}</span>
                    <span class="nb-muted">{{ r.activeUsers }}</span>
                  </div>
                }
                @if (pickedUsers().length > 0) {
                  <div class="nb-preview-row">
                    <span>Personas elegidas</span>
                    <span class="nb-muted">{{ pickedUsers().length }}</span>
                  </div>
                  @for (u of pickedUsers(); track u.userId) {
                    <div class="nb-preview-person">{{ u.fullName }}</div>
                  }
                }
                <p class="nb-muted nb-note">Quien envía no lo recibe.</p>

                @if (submitError()) {
                  <p class="nb-error">{{ submitError() }}</p>
                }

                <button
                  uiButton
                  variant="primary"
                  class="nb-send-btn"
                  [disabled]="!canSend()"
                  [loading]="submitting()"
                  (click)="submit()"
                >
                  Enviar a {{ previewCount() }} persona{{ previewCount() === 1 ? '' : 's' }}
                </button>
              </ui-card>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .nb-page {
        width: 100%;
        box-sizing: border-box;
      }
      .nb-body {
        padding: var(--sp-8);
      }
      .nb-skeleton {
        height: 320px;
        background: var(--faint);
      }
      .nb-grid {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: var(--sp-6);
        align-items: start;
      }
      .nb-main,
      .nb-side {
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
      }
      .nb-label {
        font-size: var(--fs-dense);
        font-weight: 700;
        color: var(--ink);
        margin: var(--sp-4) 0 var(--sp-2);
      }
      .nb-roles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-2) var(--sp-4);
      }
      .nb-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-2);
        margin-top: var(--sp-3);
      }
      .nb-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
        max-width: 240px;
        padding: 6px var(--sp-3);
        font-size: var(--fs-meta);
        background: var(--faint);
        color: var(--ink);
        border-radius: var(--radius-control);
      }
      .nb-chip-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nb-chip button {
        flex: none;
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        color: var(--ink-muted);
        padding: 0;
      }
      .nb-preview-count {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        margin: 0 0 var(--sp-3);
        color: var(--ink);
      }
      .nb-preview-row {
        display: flex;
        justify-content: space-between;
        font-size: var(--fs-dense);
        padding: 6px 0;
        border-bottom: 1px solid var(--hairline);
      }
      .nb-preview-person {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
        padding: 2px 0 2px var(--sp-2);
      }
      .nb-muted {
        color: var(--ink-muted);
      }
      .nb-note {
        font-size: var(--fs-meta);
        margin: var(--sp-4) 0;
      }
      .nb-error {
        color: var(--status-danger);
        font-size: var(--fs-dense);
        margin: 0 0 var(--sp-3);
      }
      .nb-send-btn {
        width: 100%;
      }

      @media (max-width: 900px) {
        .nb-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .nb-body {
          padding: var(--sp-4);
        }
        .nb-roles {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class NotificationNewBroadcastPage {
  private notificationSvc = inject(NotificationAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected maxLength = MAX_MESSAGE_LENGTH;

  protected loading = signal(true);
  protected loadError = signal(false);
  protected message = signal('');
  protected roles = signal<RecipientRoleView[]>([]);
  protected selectedRoleCodes = signal<Set<string>>(new Set());
  protected allRecipients = signal<RecipientView[]>([]);
  protected pickedUsers = signal<RecipientView[]>([]);
  protected submitting = signal(false);
  protected submitError = signal('');

  protected messageLength = computed(() => this.message().length);

  /** Administrador y Supervisor no tienen bandeja: el formulario no los ofrece — sección 9.2/10.4. */
  protected availableRoles = computed(() =>
    this.roles().filter((r) => !BROADCAST_EXCLUDED_ROLE_CODES.has(r.code)),
  );

  protected selectedRoleRows = computed(() => {
    const codes = this.selectedRoleCodes();
    return this.roles().filter((r) => codes.has(r.code));
  });

  /** Vista previa: personas distintas con alguno de los roles marcados, más las elegidas a mano, sin quien envía — sección 10.4. */
  protected previewUserIds = computed(() => {
    const selectedNames = new Set(this.selectedRoleRows().map((r) => r.name));
    const selfId = this.auth.currentUser()?.userId;
    const ids = new Set<number>();
    for (const person of this.allRecipients()) {
      if (person.userId === selfId) continue;
      if (person.roleNames.some((name) => selectedNames.has(name))) ids.add(person.userId);
    }
    for (const u of this.pickedUsers()) {
      if (u.userId !== selfId) ids.add(u.userId);
    }
    return ids;
  });

  protected previewCount = computed(() => this.previewUserIds().size);

  protected canSend = computed(
    () =>
      this.message().trim().length > 0 &&
      this.messageLength() <= this.maxLength &&
      (this.selectedRoleCodes().size > 0 || this.pickedUsers().length > 0) &&
      this.previewCount() > 0,
  );

  protected searchPeople = (query: string) => {
    const q = query.trim().toLowerCase();
    const pickedIds = new Set(this.pickedUsers().map((u) => u.userId));
    const selfId = this.auth.currentUser()?.userId;
    const results: UiLookupItem[] = this.allRecipients()
      .filter(
        (p) =>
          p.userId !== selfId && !pickedIds.has(p.userId) && p.fullName.toLowerCase().includes(q),
      )
      .slice(0, 20)
      .map((p) => ({ id: p.userId, name: p.fullName, extraInfo: p.roleNames.join(', ') }));
    return of(results);
  };

  constructor() {
    this.loadCatalogs();
  }

  protected loadCatalogs() {
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin({
      roles: this.notificationSvc.cachedRoles(),
      recipients: this.notificationSvc.cachedAllRecipients(),
    }).subscribe({
      next: ({ roles, recipients }) => {
        this.roles.set(roles);
        this.allRecipients.set(recipients);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected toggleRole(code: string) {
    this.selectedRoleCodes.update((set) => {
      const next = new Set(set);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  protected addPerson(item: UiLookupItem) {
    const person = this.allRecipients().find((p) => p.userId === item.id);
    if (!person) return;
    this.pickedUsers.update((list) => [...list, person]);
  }

  protected removePerson(userId: number) {
    this.pickedUsers.update((list) => list.filter((u) => u.userId !== userId));
  }

  protected submit() {
    if (!this.canSend() || this.submitting()) return;
    const count = this.previewCount();
    this.dialog
      .confirm({
        title: 'Nuevo envío',
        message: `Se enviará el mensaje a ${count} persona${count === 1 ? '' : 's'}. No se puede editar ni borrar después. ¿Enviar?`,
        confirmLabel: 'Enviar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.submitError.set('');
        this.submitting.set(true);
        this.notificationSvc
          .send({
            message: this.message().trim(),
            roleCodes: [...this.selectedRoleCodes()],
            userIds: this.pickedUsers().map((u) => u.userId),
          })
          .subscribe({
            next: (result) => {
              this.submitting.set(false);
              this.toast.success(
                `Enviado a ${result.recipients} personas. A ${result.deliveredLive} les llegó al instante; el resto lo verá al abrir la app.`,
              );
              this.router.navigate(['/notificaciones/envios'], {
                queryParams: { broadcastId: result.broadcastId },
              });
            },
            error: (err) => {
              this.submitting.set(false);
              this.submitError.set(
                err?.error?.detail ?? err?.error?.message ?? 'No pudimos enviar el mensaje.',
              );
            },
          });
      });
  }
}
