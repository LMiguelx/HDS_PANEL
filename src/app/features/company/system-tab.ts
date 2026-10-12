import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiCard } from '../../shared/ui/card/card';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { MaintenanceService } from '../../core/maintenance/maintenance.service';
import { CompanyModuleTabs } from './ui/module-tabs';
import { dateTimeText } from '../assignments/assignment-format';

/**
 * Empresa → Sistema → Modo mantenimiento — doc 38, sección 10. Reemplaza la
 * pantalla suelta de Mantenimiento: ahora vive como la última tarjeta de
 * Empresa, visible solo con `system.maintenance.manage`. El estado es
 * compartido (`MaintenanceService`) con el aviso de la barra superior.
 */
@Component({
  selector: 'app-system-tab',
  imports: [UiButton, UiField, UiCard, UiEmpty, HasPermissionDirective, CompanyModuleTabs],
  template: `
    <app-company-module-tabs />
    <section class="sys-page" *hasPermission="'system.maintenance.manage'">
      <h1>Sistema</h1>

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
        <ui-card title="Modo mantenimiento" class="sys-card">
          <p class="sys-help">
            Bloquea el acceso al sistema mientras se hace una intervención.
            <strong>Afecta a todas las empresas del sistema.</strong> Quien tiene este permiso sigue
            pudiendo entrar.
          </p>

          @if (s.enabled) {
            <div class="sys-status sys-status-on">
              <span class="sys-dot"></span>
              Activo
            </div>
            <p class="sys-meta">
              Desde las {{ dateTimeText(s.enabledAt) }} · por {{ s.enabledBy }}
              @if (s.reason) {
                · "{{ s.reason }}"
              }
            </p>
            <div class="sys-actions">
              <button uiButton variant="primary" [loading]="saving()" (click)="turnOff()">
                Desactivar mantenimiento
              </button>
            </div>
          } @else {
            <div class="sys-status sys-status-off">
              <span class="sys-dot"></span>
              Inactivo
            </div>
            <ui-field label="Motivo (opcional)" [(value)]="reason" />
            <div class="sys-actions">
              <button uiButton variant="primary" [loading]="saving()" (click)="turnOn()">
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
    </section>
  `,
  styles: [
    `
      .sys-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 var(--sp-5);
        color: var(--ink);
      }
      .sys-skeleton {
        height: 200px;
        background: var(--faint);
      }
      .sys-card {
        max-width: var(--card-w-sm);
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
      }
      .sys-help {
        margin: 0;
        font-size: var(--fs-dense);
        color: var(--ink-muted);
      }
      .sys-status {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-weight: 700;
      }
      .sys-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .sys-status-off {
        color: var(--ink-muted);
      }
      .sys-status-off .sys-dot {
        background: var(--ink-muted);
      }
      .sys-status-on {
        color: var(--status-warn);
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
        padding: var(--sp-2) var(--sp-3);
        border-radius: var(--radius-control);
      }
      .sys-status-on .sys-dot {
        background: var(--status-warn);
      }
      .sys-meta {
        margin: 0;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .sys-actions {
        display: flex;
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
        title: 'Activar mantenimiento',
        message:
          'Nadie sin este permiso podrá usar el sistema, en ninguna empresa, hasta que lo desactives. ¿Activar el modo mantenimiento?',
        confirmLabel: 'Activar mantenimiento',
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
