import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiCard } from '../../shared/ui/card/card';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiStatus } from '../../shared/ui/status/status';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { MaintenanceService } from '../../core/maintenance/maintenance.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import { CompanyModuleTabs } from './ui/module-tabs';
import { OrderIntakeCard } from './ui/order-intake-card';
import { ClosureHistoryCard } from './ui/closure-history-card';
import { AssignmentCycleCard } from './ui/assignment-cycle-card';
import { dateTimeText } from '../assignments/assignment-format';

/**
 * Empresa → Sistema — doc 38 (Modo mantenimiento) y doc 65, secciones 2 y 3
 * (Toma de pedidos, Historial de cierres, Ciclo de asignaciones). Cada
 * tarjeta se muestra solo con su propio permiso (sección 6 del doc 65); la
 * pestaña misma aparece si el usuario tiene al menos uno de los tres (ver
 * `CompanyModuleTabs`). "Programar cierre" (dentro de Toma de pedidos) es el
 * único botón primario de la pantalla.
 */
@Component({
  selector: 'app-system-tab',
  imports: [
    UiButton,
    UiField,
    UiCard,
    UiEmpty,
    UiStatus,
    HasPermissionDirective,
    CompanyModuleTabs,
    OrderIntakeCard,
    ClosureHistoryCard,
    AssignmentCycleCard,
  ],
  template: `
    <app-company-module-tabs />
    <section class="sys-page">
      <div class="sys-head">
        <span class="sys-eyebrow">Administración · Empresa</span>
        <h1>Sistema</h1>
      </div>

      <div class="sys-grid">
        <app-order-intake-card *hasPermission="PERMISSIONS.ORDER_INTAKE_MANAGE" />

        <app-closure-history-card *hasPermission="PERMISSIONS.ORDER_INTAKE_MANAGE" />

        <app-assignment-cycle-card *hasPermission="PERMISSIONS.CONFIG_EDIT" />

        @if (maintenance.loading() && !maintenance.status()) {
          <div class="sys-skeleton" role="status" aria-label="Cargando"></div>
        } @else if (maintenance.error() && !maintenance.status()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar el estado del mantenimiento"
            actionLabel="Reintentar"
            (action)="maintenance.refresh()"
          />
        } @else if (maintenance.status(); as s) {
          <ui-card
            title="Modo mantenimiento"
            class="sys-card"
            *hasPermission="'system.maintenance.manage'"
          >
            <p class="sys-alert-warn">
              <span class="material-icons" aria-hidden="true">warning</span>
              Bloquea el acceso al sistema mientras se hace una intervención. Afecta a todas las
              empresas del sistema. Quien tiene este permiso sigue pudiendo entrar.
            </p>

            <ui-status
              [label]="s.enabled ? 'Activo' : 'Inactivo'"
              [status]="s.enabled ? 'en ruta' : 'cerrado'"
            />

            @if (s.enabled) {
              <p class="sys-meta">
                Desde las {{ dateTimeText(s.enabledAt) }} · por {{ s.enabledBy }}
                @if (s.reason) {
                  · "{{ s.reason }}"
                }
              </p>
              <div class="sys-actions">
                <button uiButton variant="secondary" [loading]="saving()" (click)="turnOff()">
                  Desactivar mantenimiento
                </button>
              </div>
            } @else {
              <ui-field label="Motivo (opcional)" [(value)]="reason" />
              <div class="sys-actions">
                <button uiButton variant="secondary" [loading]="saving()" (click)="turnOn()">
                  Activar mantenimiento
                </button>
              </div>
            }

            @if (actionError()) {
              <p class="sys-error">{{ actionError() }}</p>
            }

            <p class="sys-note">Si el servidor se reinicia, el modo mantenimiento se desactiva.</p>
          </ui-card>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .sys-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .sys-head {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-bottom: var(--sp-5);
      }
      .sys-eyebrow {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        font-weight: 800;
      }
      .sys-head h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .sys-skeleton {
        height: 200px;
        background: var(--faint);
      }
      .sys-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-5);
        align-items: start;
      }
      .sys-grid > app-order-intake-card,
      .sys-grid > app-closure-history-card {
        grid-column: 1 / -1;
      }
      @media (max-width: 900px) {
        .sys-grid {
          grid-template-columns: 1fr;
        }
      }
      .sys-card {
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
      }
      .sys-alert-warn {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-2);
        margin: 0;
        padding: var(--sp-3) var(--sp-4);
        border-left: 3px solid var(--status-warn);
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
        border-radius: var(--radius-control, 0);
        font-size: var(--fs-dense);
        color: var(--ink);
      }
      .sys-alert-warn .material-icons {
        font-size: 18px;
        color: var(--status-warn);
        flex: none;
      }
      .sys-meta {
        margin: 0;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .sys-actions {
        display: flex;
        margin: var(--sp-2) 0;
      }
      .sys-error {
        margin: 0;
        font-size: var(--fs-dense);
        color: var(--status-danger);
      }
      .sys-note {
        margin: 0;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }

      @media (max-width: 767px) {
        .sys-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class SystemTabPage {
  protected maintenance = inject(MaintenanceService);
  protected PERMISSIONS = PERMISSIONS;
  private dialog = inject(UiDialogService);

  protected dateTimeText = dateTimeText;
  protected reason = signal('');
  protected saving = signal(false);
  protected actionError = signal('');

  constructor() {
    this.maintenance.refresh();
  }

  protected turnOn() {
    this.dialog
      .confirm({
        title: '¿Activar el modo mantenimiento?',
        message: `Afecta a todas las empresas del sistema. Motivo: ${this.reason().trim() || '—'}`,
        confirmLabel: 'Activar mantenimiento',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.actionError.set('');
        this.saving.set(true);
        this.maintenance.turnOn(this.reason()).subscribe({
          next: (s) => {
            this.saving.set(false);
            this.maintenance.status.set(s);
            this.reason.set('');
          },
          error: (err) => {
            this.saving.set(false);
            this.actionError.set(
              err?.error?.detail ?? err?.error?.message ?? 'No pudimos activarlo.',
            );
            this.maintenance.refresh();
          },
        });
      });
  }

  protected turnOff() {
    this.actionError.set('');
    this.saving.set(true);
    this.maintenance.turnOff().subscribe({
      next: (s) => {
        this.saving.set(false);
        this.maintenance.status.set(s);
      },
      error: (err) => {
        this.saving.set(false);
        this.actionError.set(
          err?.error?.detail ?? err?.error?.message ?? 'No pudimos desactivarlo.',
        );
        this.maintenance.refresh();
      },
    });
  }
}
