import { Component, computed, inject, signal } from '@angular/core';
import { of } from 'rxjs';
import { UiButton } from '../../../shared/ui/button/button';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { LocationPicker } from '../../../shared/ui/location-picker/location-picker';
import { UI_DIALOG_DATA, UiDialogRef, UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { CustomerService } from '../customer';
import { CatalogLookupService } from '../../catalog/catalog-lookup';
import {
  CustomerDetail,
  CustomerEditOptions,
  EditCustomerCommand,
} from '../../../shared/models/customer.models';
import { UbigeoView } from '../../../shared/models/customer-request.models';
import { flattenUbigeoTree, ubigeoText } from '../../../shared/utils/ubigeo';
import { isValidPhoneFormat, normalizePhoneForCompare } from '../../../shared/utils/phone-view';

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Mismo redondeo que `location-picker` — comparar coordenadas "por valor" (doc 83, sección 1.1). */
function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

/** Igual que compara el backend — doc 95, parte 1.2: en mayúsculas y sin espacios repetidos. */
function normalizeAddressForCompare(text: string): string {
  return text.trim().toUpperCase().replace(/\s+/g, ' ');
}

const MAX_PHONE_LENGTH = 20;
const MAX_ADDRESS_LENGTH = 200;

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
  imports: [UiButton, UiModal, UiField, UiTypeahead, UiEmpty, LocationPicker],
  template: `
    <ui-modal
      title="Editar datos del cliente"
      [subtitle]="data.customer.code + ' · ' + data.customer.businessName"
      [wide]="true"
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
          <div class="ecd-cols">
            <div class="ecd-col">
              <div class="ecd-col-title">Datos</div>
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

              <ui-field
                label="Tipo de cliente"
                type="select"
                [value]="customerTypeIdStr()"
                (valueChange)="onCustomerTypeChange($event)"
                [options]="customerTypeOptions()"
              />

              <ui-field
                label="Teléfono"
                [value]="phone()"
                (valueChange)="onPhoneChange($event)"
                [hint]="phoneFieldError() ? '' : 'Solo números. Se guarda sin espacios ni guiones.'"
                [error]="phoneFieldError()"
              />

              @if (hasCustomerTypeChange()) {
                <div class="ecd-warn-banner">
                  El tipo de cliente define los precios. Los pedidos nuevos usarán los precios de
                  {{ customerTypeAfterText() }}; los pedidos abiertos conservan sus precios hasta
                  que se recalculen.
                </div>
              }
              @if (hasDocTypeChange()) {
                <div class="ecd-warn-banner">
                  El tipo de documento define si se emite boleta o factura. Cámbialo también en el
                  ERP antes de facturar.
                </div>
              }

              @if (hasAnyChange()) {
                <div class="ecd-summary">
                  <div class="ecd-summary-title">Resumen de cambios</div>
                  @if (hasNameChange()) {
                    <div class="ecd-summary-row">
                      Razón social:
                      <span class="ecd-before">{{ data.customer.businessName }}</span> →
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
                      <span class="ecd-before">{{ data.customer.customerTypeName || '—' }}</span>
                      → {{ customerTypeAfterText() }}
                    </div>
                  }
                  @if (hasPhoneChange()) {
                    <div class="ecd-summary-row">
                      Teléfono: <span class="ecd-before">{{ data.customer.phone || '—' }}</span> →
                      {{ phone() }}
                    </div>
                  }
                  @if (hasAddressChange()) {
                    <div class="ecd-summary-row">
                      Dirección:
                      <span class="ecd-before">{{ data.customer.address || '—' }}</span> →
                      {{ address() }}
                    </div>
                  }
                  @if (hasUbigeoChange()) {
                    <div class="ecd-summary-row">
                      Ubigeo:
                      <span class="ecd-before">{{ ubigeoText(data.customer.ubigeo) }}</span> →
                      {{ ubigeo()?.name }}
                    </div>
                  }
                </div>
              }
            </div>

            <div class="ecd-col">
              <div class="ecd-col-title">Ubicación</div>
              <app-location-picker
                [(latitude)]="latitude"
                [(longitude)]="longitude"
                [(address)]="address"
                [referenceLatitude]="data.customer.latitude"
                [referenceLongitude]="data.customer.longitude"
                [autoFillAddress]="false"
                [addressMaxLength]="maxAddressLength"
                [addressError]="addressFieldError()"
              />
              @if (latLngError()) {
                <div class="ecd-error-banner">{{ latLngError() }}</div>
              }

              <div class="ecd-field">
                <ui-typeahead
                  label="Ubigeo (opcional)"
                  [placeholder]="
                    data.customer.ubigeo ? 'Distrito · Provincia · Departamento' : 'Sin ubigeo'
                  "
                  [clearOnPick]="false"
                  [search]="ubigeoSearch"
                  [selected]="ubigeo()"
                  (selectedChange)="onUbigeoChange($event)"
                  [error]="ubigeoError()"
                />
              </div>
            </div>
          </div>
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
      .ecd-skeleton {
        height: 220px;
        background: var(--faint);
      }
      .ecd-cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 28px;
        align-items: start;
      }
      .ecd-col {
        display: grid;
        gap: 16px;
        min-width: 0;
      }
      .ecd-col-title {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
        font-weight: 800;
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

      @media (max-width: 860px) {
        .ecd-cols {
          grid-template-columns: 1fr;
          gap: 24px;
        }
      }
    `,
  ],
})
export class EditCustomerDialog {
  protected data = inject<EditCustomerDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<CustomerDetail | null>);
  private customerSvc = inject(CustomerService);
  private catalogSvc = inject(CatalogLookupService);
  private toast = inject(ToastService);
  private dialog = inject(UiDialogService);

  protected maxNameLength = MAX_NAME_LENGTH;
  protected maxAddressLength = MAX_ADDRESS_LENGTH;
  protected ubigeoText = ubigeoText;

  protected options = signal<CustomerEditOptions | null>(null);
  protected optionsError = signal(false);

  protected businessName = signal(this.data.customer.businessName);
  protected documentTypeIdStr = signal(String(this.data.customer.documentTypeId ?? ''));
  protected documentNumber = signal(this.data.customer.documentNumber ?? '');
  protected customerTypeIdStr = signal(String(this.data.customer.customerTypeId ?? ''));
  protected phone = signal(this.data.customer.phone ?? '');
  protected latitude = signal(this.data.customer.latitude);
  protected longitude = signal(this.data.customer.longitude);
  protected address = signal(this.data.customer.address ?? '');
  protected ubigeo = signal<UiLookupItem | null>(
    this.data.customer.ubigeo
      ? {
          id: 0,
          code: this.data.customer.ubigeo.ubigeoCode,
          name: ubigeoText(this.data.customer.ubigeo),
        }
      : null,
  );
  private ubigeoDistricts = signal<UbigeoView[]>([]);

  protected saving = signal(false);
  protected banner = signal('');
  protected nameError = signal('');
  protected docTypeError = signal('');
  protected docNumberApiError = signal('');
  protected phoneApiError = signal('');
  protected addressApiError = signal('');
  protected latLngError = signal('');
  protected ubigeoError = signal('');

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

  /** Solo los dígitos (y el `+`) — doc 95, parte 1: mismo criterio que aplica el backend al guardar. */
  protected hasPhoneChange = computed(
    () =>
      normalizePhoneForCompare(this.phone()) !==
      normalizePhoneForCompare(this.data.customer.phone ?? ''),
  );
  /**
   * Solo bloquea si se tocó el teléfono — doc 83, sección 1.1 y doc 95,
   * parte 1.4: un teléfono raro ya guardado se puede dejar intacto.
   */
  protected phoneLiveError = computed(() => {
    if (!this.hasPhoneChange()) return '';
    const trimmed = this.phone().trim();
    if (!trimmed) return 'El teléfono no puede quedar vacío';
    if (!isValidPhoneFormat(trimmed)) {
      return `El teléfono debe tener solo números, de 6 a 15 dígitos (se recibió: ${trimmed})`;
    }
    return '';
  });
  protected phoneFieldError = computed(() => this.phoneApiError() || this.phoneLiveError());

  /** Latitud y longitud van siempre juntas — doc 83, sección 1.1. */
  protected hasLocationChange = computed(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    if (lat == null || lng == null) return false;
    const refLat = this.data.customer.latitude;
    const refLng = this.data.customer.longitude;
    if (refLat == null || refLng == null) return true;
    return round8(lat) !== round8(refLat) || round8(lng) !== round8(refLng);
  });

  protected hasUbigeoChange = computed(() => {
    const code = this.ubigeo()?.code;
    return !!code && code !== this.data.customer.ubigeo?.ubigeoCode;
  });

  /** En mayúsculas y sin espacios repetidos, igual que compara el backend — doc 95, parte 1.2. */
  protected hasAddressChange = computed(
    () =>
      normalizeAddressForCompare(this.address()) !==
      normalizeAddressForCompare(this.data.customer.address ?? ''),
  );
  /** Solo bloquea si se tocó la dirección — mismo criterio que el teléfono (doc 95, parte 1.3). */
  protected addressLiveError = computed(() =>
    this.hasAddressChange() && !this.address().trim() ? 'La dirección no puede quedar vacía' : '',
  );
  protected addressFieldError = computed(() => this.addressApiError() || this.addressLiveError());

  protected hasAnyChange = computed(
    () =>
      this.hasNameChange() ||
      this.hasDocTypeChange() ||
      this.hasDocNumberChange() ||
      this.hasCustomerTypeChange() ||
      this.hasPhoneChange() ||
      this.hasLocationChange() ||
      this.hasAddressChange() ||
      this.hasUbigeoChange(),
  );

  /** Filtra en memoria la lista ya aplanada — doc 74, sección 2.3.1: el árbol se pide una sola vez. */
  protected ubigeoSearch = (q: string) => of(this.filterUbigeos(q));

  private filterUbigeos(q: string): UiLookupItem[] {
    const needle = normalize(q.trim());
    const matches = this.ubigeoDistricts().filter((u) =>
      normalize(`${u.district} ${u.province} ${u.department}`).includes(needle),
    );
    return matches
      .slice(0, 20)
      .map((u, i): UiLookupItem => ({ id: i, code: u.ubigeoCode, name: ubigeoText(u) }));
  }

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
    () =>
      this.hasAnyChange() &&
      !this.docNumberLiveError() &&
      !this.phoneLiveError() &&
      !this.addressLiveError() &&
      !this.saving() &&
      !!this.options(),
  );

  constructor() {
    this.loadOptions();
    this.catalogSvc.ubigeoTree().subscribe({
      next: (tree) => this.ubigeoDistricts.set(flattenUbigeoTree(tree)),
      error: () => this.ubigeoDistricts.set([]),
    });
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

  protected onPhoneChange(v: string) {
    this.phone.set(v.slice(0, MAX_PHONE_LENGTH));
    this.phoneApiError.set('');
  }

  protected onUbigeoChange(item: UiLookupItem | null) {
    this.ubigeo.set(item);
    this.ubigeoError.set('');
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
    if (this.hasPhoneChange()) cmd.phone = this.phone().trim();
    if (this.hasLocationChange()) {
      cmd.latitude = this.latitude()!;
      cmd.longitude = this.longitude()!;
    }
    if (this.hasUbigeoChange()) cmd.ubigeoCode = this.ubigeo()!.code!;
    if (this.hasAddressChange()) cmd.address = this.address().trim();
    return cmd;
  }

  /**
   * Ubica el mensaje del backend bajo el campo correcto — doc 70, sección
   * 1.4 (doc 74, sección 4: ya no hay 409 de solicitud pendiente); doc 83,
   * sección 1.4: teléfono/latitud/longitud/ubigeo. "Envía la latitud y la
   * longitud juntas" no debería pasar si el panel arma bien el body — va a
   * la banda general, no bajo un campo (por eso se revisa antes).
   */
  private placeError(message: string) {
    const m = message.toLowerCase();
    if (m.includes('no existe') || m.includes('no hay cambios') || m.includes('juntas')) {
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
    if (m.includes('teléfono') || m.includes('telefono')) {
      this.phoneApiError.set(message);
      return;
    }
    if (m.includes('dirección') || m.includes('direccion')) {
      this.addressApiError.set(message);
      return;
    }
    if (m.includes('latitud') || m.includes('longitud')) {
      this.latLngError.set(message);
      return;
    }
    if (m.includes('ubigeo')) {
      this.ubigeoError.set(message);
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
    this.nameError.set('');
    this.docTypeError.set('');
    this.docNumberApiError.set('');
    this.phoneApiError.set('');
    this.addressApiError.set('');
    this.latLngError.set('');
    this.ubigeoError.set('');
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
}
