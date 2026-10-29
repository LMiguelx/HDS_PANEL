import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { CompanyAdminService } from '../company-admin';
import { ConfigView } from '../../../shared/models/tenant.models';

export interface ConfigFormDialogData {
  config?: ConfigView; // presente = edición
}

const TYPE_OPTIONS: UiFieldOption[] = [
  { value: 'BOOLEAN', label: 'Booleano' },
  { value: 'NUMBER', label: 'Número' },
  { value: 'TEXT', label: 'Texto' },
];

/** Crear/editar un parámetro — PUT /api/tenant/configurations (upsert). `config.edit`. */
@Component({
  selector: 'app-config-form-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="cfd">
      <h2 class="cfd-title">{{ data.config ? 'Editar parámetro' : 'Nuevo parámetro' }}</h2>

      <div class="cfd-grid">
        <ui-field label="Código" [(value)]="code" [disabled]="!!data.config" />
        <ui-field label="Grupo" [(value)]="configGroup" />
        <ui-field label="Tipo" type="select" [(value)]="configType" [options]="typeOptions" />
        <ui-field label="Valor" [(value)]="value" />
        <ui-field label="Descripción" [(value)]="description" />
      </div>

      @if (error()) {
        <div class="cfd-error">{{ error() }}</div>
      }

      <div class="cfd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Guardar parámetro
        </button>
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .cfd {
        display: grid;
        gap: 16px;
        width: 100%;
      }
      .cfd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .cfd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 14px;
      }
      .cfd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .cfd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class ConfigFormDialog {
  protected data = inject<ConfigFormDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<ConfigView | false>);
  private companySvc = inject(CompanyAdminService);

  protected typeOptions = TYPE_OPTIONS;

  protected code = signal(this.data.config?.code ?? '');
  protected configGroup = signal(this.data.config?.configGroup ?? '');
  protected configType = signal(this.data.config?.configType ?? 'TEXT');
  protected value = signal(this.data.config?.value ?? '');
  protected description = signal(this.data.config?.description ?? '');

  protected saving = signal(false);
  protected error = signal('');

  protected submit() {
    if (!this.code().trim() || !this.configGroup().trim() || !this.value().trim()) {
      this.error.set('Código, grupo y valor son obligatorios.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.companySvc
      .putConfiguration({
        code: this.code().trim(),
        configGroup: this.configGroup().trim(),
        configType: this.configType(),
        value: this.value().trim(),
        description: this.description().trim(),
      })
      .subscribe({
        next: (config) => {
          this.saving.set(false);
          this.ref.close(config);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(
            detalle ? `No pudimos guardar: ${detalle}` : 'No pudimos guardar el parámetro.',
          );
        },
      });
  }
}
