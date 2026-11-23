import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { CompanyAdminService } from '../company-admin';
import { BranchView } from '../../../shared/models/tenant.models';

/** Alta de sede — POST /api/tenant/branches. `config.edit`. */
@Component({
  selector: 'app-branch-form-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="bfd">
      <h2 class="bfd-title">Nueva sede</h2>

      <div class="bfd-grid">
        <ui-field label="Código" [(value)]="code" hint="Máx. 10" />
        <ui-field label="Nombre" [(value)]="name" hint="Máx. 100" />
        <ui-field label="Dirección" [(value)]="address" />
        <ui-field label="Ubigeo" [(value)]="ubigeo" hint="Código INEI de 6 dígitos" />
      </div>

      @if (error()) {
        <div class="bfd-error">{{ error() }}</div>
      }

      <div class="bfd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Crear sede
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
      .bfd {
        display: grid;
        gap: 16px;
        width: 100%;
      }
      .bfd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .bfd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 14px;
      }
      .bfd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .bfd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class BranchFormDialog {
  protected ref = inject(UiDialogRef<BranchView | false>);
  private companySvc = inject(CompanyAdminService);

  protected code = signal('');
  protected name = signal('');
  protected address = signal('');
  protected ubigeo = signal('');

  protected saving = signal(false);
  protected error = signal('');

  protected submit() {
    if (!this.code().trim() || !this.name().trim()) {
      this.error.set('Código y nombre son obligatorios.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.companySvc
      .createBranch({
        code: this.code().trim(),
        name: this.name().trim(),
        address: this.address().trim(),
        ubigeo: this.ubigeo().trim(),
      })
      .subscribe({
        next: (branch) => {
          this.saving.set(false);
          this.ref.close(branch);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(
            detalle ? `No pudimos crear la sede: ${detalle}` : 'No pudimos crear la sede.',
          );
        },
      });
  }
}
