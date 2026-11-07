import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../../shared/ui/button/button';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UI_DIALOG_DATA, UiDialogRef, UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { CustomerService } from '../customer';
import {
  CustomerDetail,
  CustomerEditOptions,
  EditCustomerCommand,
} from '../../../shared/models/customer.models';

export interface EditCustomerDialogData {
  customer: CustomerDetail;
}

const MAX_NAME_LENGTH = 150;

/**
 * "Editar datos del cliente" — doc 70, sección 1. Edición directa desde el
 * panel (customer.edit): no pasa por una solicitud del vendedor ni toca el
 * ERP, queda aprobada de una vez en el historial del cliente.
 */
@Component({
  selector: 'app-edit-customer-dialog',
  imports: [UiButton, UiModal, UiField, UiEmpty],
  template: `
    <ui-modal
      title="Editar datos del cliente"
      [subtitle]="data.customer.code + ' · ' + data.customer.businessName"
      (close)="onClose()"
    >
      <div class="ecd">
        <div class="ecd-info-banner">
          Estos cambios se aplican en el app al guardar. No se envían al ERP: corrígelos también en
          el ERP.
        </div>

        @if (banner()) {
          <div class="ecd-error-banner">
            {{ banner() }}
            @if (showApprovalsLink()) {
              <button type="button" class="ecd-link" (click)="goToApprovals()">
                Ir a Aprobaciones
              </button>
            }
          </div>
        }

        @if (optionsError()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar las opciones del formulario"
            actionLabel="Reintentar"
            (action)="loadOptions()"
          />
        } @else if (!options()) {
          <div class="ecd-skeleton" role="status" aria-label="Cargando"></div>
        } @else {
          <div class="ecd-field">
            <label>Código</label>
            <div class="ecd-readonly">{{ data.customer.code }}</div>
          </div>

          <ui-field
            label="Razón social"
            [value]="businessName()"
            (valueChange)="onNameChange($event)"
            [hint]="nameError() ? '' : businessName().length + '/' + maxNameLength"
            [error]="nameError()"
          />

          <div class="ecd-doc-row">
            <ui-field
              label="Tipo de documento"
              type="select"
              [value]="documentTypeIdStr()"
              (valueChange)="onDocTypeChange($event)"
              [options]="docTypeOptions()"
              [error]="docTypeError()"
            />
            <ui-field
              label="Número de documento"
              [value]="documentNumber()"
              (valueChange)="onDocNumberChange($event)"
              [hint]="docNumberFieldError() ? '' : docNumberHint()"
              [error]="docNumberFieldError()"
            />
          </div>

          <ui-field
            label="Tipo de cliente"
            type="select"
            [value]="customerTypeIdStr()"
            (valueChange)="onCustomerTypeChange($event)"
            [options]="customerTypeOptions()"
          />

          @if (hasCustomerTypeChange()) {
            <div class="ecd-warn-banner">
              El tipo de cliente define los precios. Los pedidos nuevos usarán los precios de
              {{ customerTypeAfterText() }}; los pedidos abiertos conservan sus precios hasta que se
              recalculen.
            </div>
          }
          @if (hasDocTypeChange()) {
            <div class="ecd-warn-banner">
              El tipo de documento define si se emite boleta o factura. Cámbialo también en el ERP
              antes de facturar.
            </div>
          }

          @if (hasAnyChange()) {
            <div class="ecd-summary">
              <div class="ecd-summary-title">Resumen de cambios</div>
              @if (hasNameChange()) {
                <div class="ecd-summary-row">
                  Razón social: <span class="ecd-before">{{ data.customer.businessName }}</span> →
                  {{ businessName() }}
                </div>
              }
              @if (hasDocumentChange()) {
                <div class="ecd-summary-row">
                  Documento: <span class="ecd-before">{{ documentBeforeText() }}</span> →
                  {{ documentAfterText() }}
                </div>
              }
              @if (hasCustomerTypeChange()) {
                <div class="ecd-summary-row">
                  Tipo de cliente:
                  <span class="ecd-before">{{ data.customer.customerTypeName || '—' }}</span> →
                  {{ customerTypeAfterText() }}
                </div>
              }
            </div>
          }
        }
      </div>

      <ng-container modalFooter>
        <button uiButton variant="secondary" (click)="onClose()">Cancelar</button>
        <button
          uiButton
          variant="primary"
          [disabled]="!canSubmit()"
          [loading]="saving()"
          (click)="submit()"
        >
          Guardar cambios
        </button>
      </ng-container>
    </ui-modal>
  `,
  styles: [
    `
      .ecd {
        display: grid;
        gap: 16px;
      }
      .ecd-info-banner {
        padding: 10px 14px;
        border: 1px solid var(--accent-ink);
        background: color-mix(in srgb, var(--accent-ink) 8%, transparent);
        font-size: 13px;
        color: var(--ink);
        line-height: 1.5;
      }
      .ecd-error-banner {
        padding: 10px 14px;
        border: 1px solid var(--status-danger);
        background: color-mix(in srgb, var(--status-danger) 8%, transparent);
        font-size: 13px;
        color: var(--ink);
      }
      .ecd-warn-banner {
        padding: 10px 14px;
        border: 1px solid var(--status-warn);
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
        font-size: 13px;
        color: var(--ink);
        line-height: 1.5;
      }
      .ecd-link {
        display: block;
        margin-top: 6px;
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        color: var(--accent-ink);
      }
      .ecd-link:hover {
        text-decoration: underline;
      }
      .ecd-skeleton {
        height: 220px;
        background: var(--faint);
      }
      .ecd-field {
        display: grid;
        gap: 6px;
      }
      .ecd-field label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .ecd-readonly {
        min-height: var(--touch-min);
        padding: 0 12px;
        display: flex;
        align-items: center;
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        color: var(--ink-muted);
        font-size: 15px;
      }
      .ecd-doc-row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .ecd-doc-row > :first-child {
        flex: 0 0 40%;
        min-width: 0;
      }
      .ecd-doc-row > :last-child {
        flex: 1 1 60%;
        min-width: 0;
      }
      .ecd-summary {
        padding: 10px 14px;
        border: 1px solid var(--hairline);
        display: grid;
        gap: 6px;
      }
      .ecd-summary-title {
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
        font-weight: 800;
      }
      .ecd-summary-row {
        font-size: 13px;
        color: var(--ink);
      }
      .ecd-before {
        color: var(--ink-muted);
        text-decoration: line-through;
      }

      @media (max-width: 599px) {
        .ecd-doc-row {
          flex-direction: column;
        }
        .ecd-doc-row > :first-child,
        .ecd-doc-row > :last-child {
          flex: 1 1 auto;
        }
      }
    `,
  ],
})
export class EditCustomerDialog {
  protected data = inject<EditCustomerDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<CustomerDetail | null>);
  private customerSvc = inject(CustomerService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private dialog = inject(UiDialogService);

  protected maxNameLength = MAX_NAME_LENGTH;

  protected options = signal<CustomerEditOptions | null>(null);
  protected optionsError = signal(false);

  protected businessName = signal(this.data.customer.businessName);
  protected documentTypeIdStr = signal(String(this.data.customer.documentTypeId ?? ''));
  protected documentNumber = signal(this.data.customer.documentNumber ?? '');
  protected customerTypeIdStr = signal(String(this.data.customer.customerTypeId ?? ''));

  protected saving = signal(false);
  protected banner = signal('');
  protected showApprovalsLink = signal(false);
  protected nameError = signal('');
  protected docTypeError = signal('');
  protected docNumberApiError = signal('');

  protected docTypeOptions = computed<UiFieldOption[]>(() =>
    (this.options()?.documentTypes ?? []).map((t) => ({
      value: String(t.documentTypeId),
      label: t.name,
    })),
  );
  protected customerTypeOptions = computed<UiFieldOption[]>(() =>
    (this.options()?.customerTypes ?? []).map((t) => ({
      value: String(t.customerTypeId),
      label: t.name,
    })),
  );

  private documentTypeId = computed(() =>
    this.documentTypeIdStr() ? Number(this.documentTypeIdStr()) : null,
  );
  private customerTypeId = computed(() =>
    this.customerTypeIdStr() ? Number(this.customerTypeIdStr()) : null,
  );
  protected selectedDocType = computed(
    () =>
      this.options()?.documentTypes.find((t) => t.documentTypeId === this.documentTypeId()) ?? null,
  );

  protected docNumberHint = computed(() => {
    const name = (this.selectedDocType()?.name ?? '').trim().toUpperCase();
    if (name === 'DNI') return '8 dígitos';
    if (name === 'RUC') return '11 dígitos';
    return '';
  });

  /** Validación en vivo con el `validationPattern` del tipo elegido; si no compila en JS, decide el backend. */
  protected docNumberLiveError = computed(() => {
    const num = this.documentNumber().trim();
    const type = this.selectedDocType();
    if (!type?.validationPattern || !num) return '';
    try {
      const re = new RegExp(type.validationPattern);
      if (!re.test(num)) return `El número no es válido para ${type.name}`;
    } catch {
      // Patrón no compila en JS: no se valida acá.
    }
    return '';
  });

  protected docNumberFieldError = computed(
    () => this.docNumberApiError() || this.docNumberLiveError(),
  );

  protected hasNameChange = computed(
    () => this.businessName().trim() !== this.data.customer.businessName,
  );
  protected hasDocTypeChange = computed(
    () => this.documentTypeId() !== this.data.customer.documentTypeId,
  );
  protected hasDocNumberChange = computed(
    () =>
      this.documentNumber().trim().toUpperCase() !==
      (this.data.customer.documentNumber ?? '').toUpperCase(),
  );
  protected hasDocumentChange = computed(
    () => this.hasDocTypeChange() || this.hasDocNumberChange(),
  );
  protected hasCustomerTypeChange = computed(
    () => this.customerTypeId() !== this.data.customer.customerTypeId,
  );
  protected hasAnyChange = computed(
    () =>
      this.hasNameChange() ||
      this.hasDocTypeChange() ||
      this.hasDocNumberChange() ||
      this.hasCustomerTypeChange(),
  );

  protected documentBeforeText = computed(() =>
    `${this.data.customer.documentTypeName ?? '—'} ${this.data.customer.documentNumber ?? ''}`.trim(),
  );
  protected documentAfterText = computed(() =>
    `${this.selectedDocType()?.name ?? '—'} ${this.documentNumber().trim()}`.trim(),
  );
  protected customerTypeAfterText = computed(
    () =>
      this.options()?.customerTypes.find((t) => t.customerTypeId === this.customerTypeId())?.name ??
      '—',
  );

  protected canSubmit = computed(
    () => this.hasAnyChange() && !this.docNumberLiveError() && !this.saving() && !!this.options(),
  );

  constructor() {
    this.loadOptions();
  }

  protected loadOptions() {
    this.optionsError.set(false);
    this.customerSvc.editOptions().subscribe({
      next: (o) => this.options.set(o),
      error: () => this.optionsError.set(true),
    });
  }

  protected onNameChange(v: string) {
    this.businessName.set(v.slice(0, MAX_NAME_LENGTH));
    this.nameError.set('');
  }

  protected onDocTypeChange(v: string) {
    this.documentTypeIdStr.set(v);
    this.docTypeError.set('');
  }

  protected onDocNumberChange(v: string) {
    this.documentNumber.set(v.toUpperCase());
    this.docNumberApiError.set('');
  }

  protected onCustomerTypeChange(v: string) {
    this.customerTypeIdStr.set(v);
  }

  protected onClose() {
    if (!this.hasAnyChange()) {
      this.ref.close(null);
      return;
    }
    this.dialog
      .confirm({ title: '¿Descartar los cambios?', message: '', confirmLabel: 'Descartar' })
      .subscribe((discard) => {
        if (discard) this.ref.close(null);
      });
  }

  private buildCommand(): EditCustomerCommand {
    const cmd: EditCustomerCommand = {};
    if (this.hasNameChange()) cmd.businessName = this.businessName().trim();
    if (this.hasDocTypeChange()) {
      cmd.documentTypeId = this.documentTypeId()!;
      cmd.documentNumber = this.documentNumber().trim();
    } else if (this.hasDocNumberChange()) {
      cmd.documentNumber = this.documentNumber().trim();
    }
    if (this.hasCustomerTypeChange()) cmd.customerTypeId = this.customerTypeId()!;
    return cmd;
  }

  /** Ubica el mensaje del backend bajo el campo correcto — doc 70, sección 1.4. */
  private placeError(message: string) {
    const m = message.toLowerCase();
    if (m.includes('solicitud de cambio pendiente')) {
      this.banner.set(message);
      this.showApprovalsLink.set(true);
      return;
    }
    if (m.includes('no existe') || m.includes('no hay cambios')) {
      this.banner.set(message);
      return;
    }
    if (m.includes('razón social') || m.includes('razon social')) {
      this.nameError.set(message);
      return;
    }
    if (m.includes('elige el tipo de documento')) {
      this.docTypeError.set(message);
      return;
    }
    if (m.includes('documento')) {
      this.docNumberApiError.set(message);
      return;
    }
    this.banner.set(message);
  }

  protected submit() {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.banner.set('');
    this.showApprovalsLink.set(false);
    this.nameError.set('');
    this.docTypeError.set('');
    this.docNumberApiError.set('');
    this.customerSvc.update(this.data.customer.customerId, this.buildCommand()).subscribe({
      next: (detail) => {
        this.saving.set(false);
        this.toast.success('Datos del cliente actualizados');
        this.ref.close(detail);
      },
      error: (err) => {
        this.saving.set(false);
        if (err?.status === 403) {
          this.toast.error('No tienes permiso para editar clientes');
          this.ref.close(null);
          return;
        }
        if (err?.status === 404) {
          this.toast.error('Este cliente ya no existe.');
          this.ref.close(null);
          return;
        }
        const message =
          err?.error?.detail ?? err?.error?.message ?? 'No pudimos guardar los cambios.';
        this.placeError(message);
      },
    });
  }

  protected goToApprovals() {
    this.router.navigate(['/aprobaciones']);
    this.ref.close(null);
  }
}
