import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiCard } from '../../shared/ui/card/card';
import { UiStatus } from '../../shared/ui/status/status';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { MaintenanceAdminService } from './maintenance-admin';
import { MaintenanceStatusView } from '../../shared/models/maintenance.models';

/**
 * Toggle de modo mantenimiento. El backend no expone un GET de estado (solo
 * POST /on y /off) — el estado se muestra "desconocido" hasta la primera
 * acción de esta sesión; ambos botones quedan disponibles y el backend
 * valida (falla si ya estaba en ese estado, el toast de error lo explica).
 */
@Component({
  selector: 'app-maintenance-page',
  imports: [UiButton, UiField, UiCard, UiStatus],
  template: `
    <section class="mnt-page">
      <div class="mnt-head">
        <h1>Modo mantenimiento</h1>
        <p class="mnt-sub">
          Bloquea el acceso al sistema mientras se hace una intervención puntual.
        </p>
      </div>

      <ui-card variant="container" class="mnt-card">
        <div class="mnt-status">
          @if (status(); as s) {
            <ui-status
              [label]="s.enabled ? 'Activado' : 'Desactivado'"
              [status]="s.enabled ? 'vencida' : 'vigente'"
            />
            @if (s.message) {
              <p class="mnt-message">{{ s.message }}</p>
            }
          } @else {
            <ui-status label="Desconocido" status="pendiente" />
            <p class="mnt-message">
              No sabremos el estado real hasta la primera acción de esta sesión.
            </p>
          }
        </div>

        <ui-field
          label="Motivo (opcional, solo al activar)"
          type="textarea"
          [rows]="2"
          [(value)]="reason"
        />

        @if (error()) {
          <div class="mnt-error">{{ error() }}</div>
        }

        <div class="mnt-actions">
          <button uiButton variant="primary" [loading]="saving()" (click)="turnOn()">
            Activar mantenimiento
          </button>
          <button uiButton variant="secondary" [loading]="saving()" (click)="turnOff()">
            Desactivar
          </button>
        </div>
      </ui-card>
    </section>
  `,
  styles: [
    `
      .mnt-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .mnt-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
        max-width: 560px;
      }
      .mnt-card {
        margin-top: 24px;
        max-width: var(--card-w-sm);
        display: grid;
        gap: 18px;
      }
      .mnt-status {
        display: grid;
        gap: 6px;
      }
      .mnt-message {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .mnt-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .mnt-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      @media (max-width: 767px) {
        .mnt-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class MaintenancePage {
  private maintenanceSvc = inject(MaintenanceAdminService);
  private dialog = inject(UiDialogService);

  protected status = signal<MaintenanceStatusView | null>(null);
  protected reason = signal('');
  protected saving = signal(false);
  protected error = signal('');

  protected turnOn() {
    this.dialog
      .confirm({
        title: 'Activar modo mantenimiento',
        message: 'Los usuarios verán un aviso de mantenimiento mientras esté activo. ¿Continuar?',
        confirmLabel: 'Activar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.saving.set(true);
        this.error.set('');
        this.maintenanceSvc.turnOn(this.reason() || undefined).subscribe({
          next: (s) => {
            this.saving.set(false);
            this.status.set(s);
          },
          error: (err) => {
            this.saving.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.error.set(
              detalle
                ? `No pudimos activarlo: ${detalle}`
                : 'No pudimos activar el modo mantenimiento.',
            );
          },
        });
      });
  }

  protected turnOff() {
    this.dialog
      .confirm({
        title: 'Desactivar modo mantenimiento',
        message: '¿Desactivar el modo mantenimiento y restaurar el acceso normal?',
        confirmLabel: 'Desactivar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.saving.set(true);
        this.error.set('');
        this.maintenanceSvc.turnOff().subscribe({
          next: (s) => {
            this.saving.set(false);
            this.status.set(s);
          },
          error: (err) => {
            this.saving.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.error.set(
              detalle
                ? `No pudimos desactivarlo: ${detalle}`
                : 'No pudimos desactivar el modo mantenimiento.',
            );
          },
        });
      });
  }
}
