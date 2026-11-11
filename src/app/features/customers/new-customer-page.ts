import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiCard } from '../../shared/ui/card/card';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { VendorVisits } from '../../shared/ui/vendor-visits/vendor-visits';
import { LocationPicker } from '../../shared/ui/location-picker/location-picker';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { CustomerService } from './customer';
import { CatalogLookupService } from '../catalog/catalog-lookup';
import { LookupService, toUiLookup } from '../promos/lookup';
import {
  CreateCustomerCommand,
  CustomerEditOptions,
  EditCustomerDocumentTypeOption,
} from '../../shared/models/customer.models';
import { UbigeoView } from '../../shared/models/customer-request.models';
import { flattenUbigeoTree, ubigeoText } from '../../shared/utils/ubigeo';
import { padCustomerCode, sanitizeCustomerCodeInput } from '../../shared/utils/customer-code';

const MAX_NAME_LENGTH = 150;

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface BannerAction {
  label: string;
  run: () => void;
}

/**
 * Nuevo cliente — doc 74, sección 2. `customer.create`. El supervisor hace
 * de ERP: código y secuencia de ruta incluidos. Página propia (no modal)
 * porque lleva mapa.
 */
@Component({
  selector: 'app-new-customer-page',
  imports: [
    UiButton,
    UiField,
    UiCard,
    UiToggle,
    UiEmpty,
    UiTypeahead,
    VendorVisits,
    LocationPicker,
  ],
  template: `
    <section class="nc-page">
      <div class="nc-head">
        <div>
          <h1>Nuevo cliente</h1>
          <p class="nc-sub">Crea el cliente con los mismos datos que tiene en el ERP.</p>
        </div>
        <div class="nc-head-actions">
          <button type="button" class="nc-cancel" (click)="cancel()">Cancelar</button>
          <button
            uiButton
            variant="primary"
            [disabled]="!canSubmit()"
            [loading]="saving()"
            (click)="submit()"
          >
            Crear cliente
          </button>
        </div>
      </div>

      @if (optionsError()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las opciones del formulario"
          actionLabel="Reintentar"
          (action)="loadOptions()"
        />
      } @else if (!options()) {
        <div class="nc-skeleton" role="status" aria-label="Cargando"></div>
      } @else {
        @if (banner()) {
          <div class="nc-banner">
            {{ banner() }}
            @if (bannerAction(); as action) {
              <button type="button" class="nc-banner-link" (click)="action.run()">
                {{ action.label }}
              </button>
            }
          </div>
        }

        <div class="nc-grid">
          <div class="nc-col-left">
            <ui-card title="Datos del ERP" class="nc-card">
              <div class="nc-warn-banner">
                El código y la secuencia deben ser los mismos que tiene el cliente en el ERP. Con un
                código distinto, sus facturas no se cruzan con este cliente.
              </div>
              <div class="nc-row">
                <div class="nc-mono-field">
                  <ui-field
                    label="Código del cliente"
                    placeholder="0000022325"
                    [value]="customerCode()"
                    (valueChange)="onCustomerCodeChange($event)"
                    (blur)="onCustomerCodeBlur()"
                    [hint]="
                      customerCodeFieldError()
                        ? ''
                        : '10 dígitos, con ceros a la izquierda, igual que en el ERP.'
                    "
                    [error]="customerCodeFieldError()"
                  />
                  @if (customerCodePadded() && !customerCodeFieldError()) {
                    <p class="nc-code-note">
                      Se completó con ceros: verifica que sea el código del ERP.
                    </p>
                  }
                </div>
                <ui-field
                  label="Secuencia de ruta"
                  type="number"
                  [value]="routeSequence()"
                  (valueChange)="routeSequence.set($event)"
                  [error]="fieldErrors()['routeSequence'] || ''"
                />
              </div>
              @if (codeFieldRequestId()) {
                <button type="button" class="nc-link" (click)="goToApprovals()">
                  Ver solicitud #{{ codeFieldRequestId() }}
                </button>
              }
            </ui-card>

            <ui-card title="Identificación" class="nc-card">
              <ui-field
                label="Razón social"
                [value]="businessName()"
                (valueChange)="onNameChange($event)"
                [hint]="
                  fieldErrors()['businessName'] ? '' : businessName().length + '/' + maxNameLength
                "
                [error]="fieldErrors()['businessName'] || ''"
              />
              <div class="nc-row nc-row-doc">
                <ui-field
                  label="Tipo de documento"
                  type="select"
                  [value]="documentTypeId()"
                  (valueChange)="onDocTypeChange($event)"
                  [options]="docTypeOptions()"
                  [error]="fieldErrors()['documentTypeId'] || ''"
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
                [value]="customerTypeId()"
                (valueChange)="onCustomerTypeChange($event)"
                [options]="customerTypeOptions()"
                [hint]="
                  fieldErrors()['customerTypeId'] ? '' : 'Define la lista de precios del cliente.'
                "
                [error]="fieldErrors()['customerTypeId'] || ''"
              />
              <ui-field
                label="Actividad"
                placeholder="Opcional"
                [value]="businessActivity()"
                (valueChange)="onActivityChange($event)"
                [error]="fieldErrors()['businessActivity'] || ''"
              />
              <ui-field
                label="Teléfono"
                [value]="phone()"
                (valueChange)="phone.set($event)"
                [error]="fieldErrors()['phone'] || ''"
              />
            </ui-card>

            <ui-card title="Vendedor y visitas" class="nc-card">
              <ui-toggle
                label="Asignar vendedor ahora"
                [(checked)]="assignVendorNow"
                [hint]="assignVendorNow() ? '' : 'El cliente quedará en Cartera como Sin vendedor.'"
              />
              @if (assignVendorNow()) {
                <app-vendor-visits
                  [search]="userSearch"
                  [(vendor)]="vendor"
                  [(weekdays)]="weekdays"
                  [(weeks)]="weeks"
                />
              }
            </ui-card>
          </div>

          <div class="nc-col-right">
            <ui-card title="Ubicación" class="nc-card nc-card-sticky">
              <app-location-picker
                [(latitude)]="latitude"
                [(longitude)]="longitude"
                [(address)]="address"
              />
              @if (fieldErrors()['latitude'] || fieldErrors()['longitude']) {
                <div class="nc-error">
                  {{ fieldErrors()['latitude'] || fieldErrors()['longitude'] }}
                </div>
              }
              @if (fieldErrors()['address']) {
                <div class="nc-error">{{ fieldErrors()['address'] }}</div>
              }

              <div class="nc-ubigeo-field">
                <ui-typeahead
                  label="Ubigeo"
                  placeholder="Distrito · Provincia · Departamento"
                  [clearOnPick]="false"
                  [search]="ubigeoSearch"
                  [selected]="ubigeo()"
                  (selectedChange)="ubigeo.set($event)"
                  [error]="fieldErrors()['ubigeoCode'] || ''"
                />
              </div>
            </ui-card>
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .nc-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .nc-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
        margin-bottom: 24px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .nc-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
        max-width: 480px;
      }
      .nc-head-actions {
        display: flex;
        align-items: center;
        gap: 16px;
        flex: none;
      }
      .nc-cancel {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-weight: 700;
        font-size: 14px;
        color: var(--ink-muted);
        padding: 0;
      }
      .nc-cancel:hover {
        color: var(--ink);
      }
      .nc-skeleton {
        height: 400px;
        background: var(--faint);
      }
      .nc-banner {
        padding: 10px 14px;
        border: 1px solid var(--status-danger);
        background: color-mix(in srgb, var(--status-danger) 8%, transparent);
        font-size: 13px;
        color: var(--ink);
        margin-bottom: 20px;
      }
      .nc-banner-link {
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
      .nc-banner-link:hover {
        text-decoration: underline;
      }
      .nc-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        align-items: start;
      }
      .nc-col-left {
        display: grid;
        gap: 20px;
      }
      .nc-card {
        max-width: none;
        display: grid;
        gap: 16px;
      }
      .nc-card-sticky {
        position: sticky;
        top: 20px;
      }
      .nc-warn-banner {
        padding: 10px 14px;
        border: 1px solid var(--status-warn);
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
        font-size: 13px;
        color: var(--ink);
        line-height: 1.5;
      }
      .nc-row {
        display: flex;
        gap: 12px;
      }
      .nc-row > * {
        flex: 1;
        min-width: 0;
      }
      .nc-row-doc > :first-child {
        flex: 0 0 40%;
      }
      .nc-row-doc > :last-child {
        flex: 1 1 60%;
      }
      .nc-mono-field ::ng-deep .ui-input {
        font-family: monospace;
        font-weight: 700;
      }
      .nc-code-note {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--status-warn);
      }
      .nc-link {
        justify-self: start;
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 700;
        color: var(--accent-ink);
      }
      .nc-link:hover {
        text-decoration: underline;
      }
      .nc-error {
        font-size: 12px;
        color: var(--status-danger);
      }
      .nc-ubigeo-field {
        margin-top: 4px;
      }

      @media (max-width: 1100px) {
        .nc-grid {
          grid-template-columns: 1fr;
        }
        .nc-card-sticky {
          position: static;
        }
      }
      @media (max-width: 767px) {
        .nc-page {
          padding: var(--sp-4);
        }
        .nc-row {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class NewCustomerPage {
  private customerSvc = inject(CustomerService);
  private catalogSvc = inject(CatalogLookupService);
  private lookupSvc = inject(LookupService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected maxNameLength = MAX_NAME_LENGTH;

  protected options = signal<CustomerEditOptions | null>(null);
  protected optionsError = signal(false);

  protected customerCode = signal('');
  protected customerCodePadded = signal(false);
  protected routeSequence = signal('');
  protected businessName = signal('');
  protected documentTypeId = signal('');
  protected documentNumber = signal('');
  protected customerTypeId = signal('');
  protected businessActivity = signal('');
  protected phone = signal('');

  protected assignVendorNow = signal(false);
  protected vendor = signal<UiLookupItem | null>(null);
  protected weekdays = signal<number[]>([]);
  protected weeks = signal<number[]>([1, 2, 3, 4]);

  protected latitude = signal<number | null>(null);
  protected longitude = signal<number | null>(null);
  protected address = signal('');
  protected ubigeo = signal<UiLookupItem | null>(null);
  private ubigeoDistricts = signal<UbigeoView[]>([]);

  protected saving = signal(false);
  protected banner = signal('');
  protected bannerAction = signal<BannerAction | null>(null);
  protected fieldErrors = signal<Record<string, string>>({});
  protected codeFieldRequestId = signal<number | null>(null);

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

  /** Filtra en memoria la lista ya aplanada — doc 74, sección 2.3.1: el árbol se pide una sola vez. */
  protected ubigeoSearch = (q: string) => of(this.filterUbigeos(q));

  private filterUbigeos(q: string): UiLookupItem[] {
    const needle = normalize(q.trim());
    const matches = this.ubigeoDistricts().filter((u) =>
      normalize(`${u.district} ${u.province} ${u.department}`).includes(needle),
    );
    return matches.slice(0, 20).map((u, i): UiLookupItem => ({
      id: i,
      code: u.ubigeoCode,
      name: ubigeoText(u),
    }));
  }

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

  private selectedDocType = computed<EditCustomerDocumentTypeOption | null>(
    () =>
      this.options()?.documentTypes.find(
        (t) => String(t.documentTypeId) === this.documentTypeId(),
      ) ?? null,
  );

  protected docNumberHint = computed(() => {
    const name = (this.selectedDocType()?.name ?? '').trim().toUpperCase();
    if (name === 'DNI') return '8 dígitos';
    if (name === 'RUC') return '11 dígitos';
    return '';
  });

  private docNumberLiveError = computed(() => {
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
    () => this.fieldErrors()['documentNumber'] || this.docNumberLiveError(),
  );

  private customerCodeLiveError = computed(() => {
    const code = this.customerCode();
    return code && code.length !== 10 ? 'El código debe tener 10 dígitos.' : '';
  });
  protected customerCodeFieldError = computed(
    () => this.fieldErrors()['customerCode'] || this.customerCodeLiveError(),
  );

  protected canSubmit = computed(() => {
    if (this.saving()) return false;
    if (this.customerCode().length !== 10) return false;
    const seq = this.routeSequence().trim();
    if (seq === '' || Number(seq) < 0 || !Number.isFinite(Number(seq))) return false;
    if (!this.businessName().trim()) return false;
    if (!this.documentTypeId()) return false;
    if (!this.documentNumber().trim() || this.docNumberLiveError()) return false;
    if (!this.customerTypeId()) return false;
    if (!this.address().trim()) return false;
    if (!this.phone().trim()) return false;
    if (this.latitude() == null || this.longitude() == null) return false;
    if (!this.ubigeo()) return false;
    if (this.assignVendorNow()) {
      if (!this.vendor()) return false;
      if (this.weekdays().length === 0) return false;
    }
    return true;
  });

  protected hasData = computed(
    () =>
      !!(
        this.customerCode().trim() ||
        this.routeSequence().trim() ||
        this.businessName().trim() ||
        this.documentNumber().trim() ||
        this.address().trim() ||
        this.phone().trim() ||
        this.businessActivity().trim() ||
        this.latitude() != null ||
        this.ubigeo()
      ),
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

  protected onCustomerCodeChange(v: string) {
    this.customerCode.set(sanitizeCustomerCodeInput(v));
    this.customerCodePadded.set(false);
    this.clearFieldError('customerCode');
    this.codeFieldRequestId.set(null);
  }

  protected onCustomerCodeBlur() {
    const code = this.customerCode();
    const padded = padCustomerCode(code);
    if (padded !== code) {
      this.customerCode.set(padded);
      this.customerCodePadded.set(true);
    }
  }

  protected onNameChange(v: string) {
    this.businessName.set(v.slice(0, MAX_NAME_LENGTH));
    this.clearFieldError('businessName');
  }

  protected onDocTypeChange(v: string) {
    this.documentTypeId.set(v);
    this.clearFieldError('documentTypeId');
  }

  protected onDocNumberChange(v: string) {
    this.documentNumber.set(v.toUpperCase().trim());
    this.clearFieldError('documentNumber');
  }

  protected onCustomerTypeChange(v: string) {
    this.customerTypeId.set(v);
    this.clearFieldError('customerTypeId');
  }

  protected onActivityChange(v: string) {
    this.businessActivity.set(v.slice(0, 60));
    this.clearFieldError('businessActivity');
  }

  private clearFieldError(field: string) {
    if (!this.fieldErrors()[field]) return;
    this.fieldErrors.update((e) => {
      const next = { ...e };
      delete next[field];
      return next;
    });
  }

  private buildCommand(): CreateCustomerCommand {
    return {
      customerCode: this.customerCode().trim(),
      routeSequence: Number(this.routeSequence()),
      businessName: this.businessName().trim(),
      documentTypeId: Number(this.documentTypeId()),
      documentNumber: this.documentNumber().trim(),
      customerTypeId: Number(this.customerTypeId()),
      address: this.address().trim(),
      businessActivity: this.businessActivity().trim() || null,
      phone: this.phone().trim(),
      latitude: this.latitude()!,
      longitude: this.longitude()!,
      ubigeoCode: this.ubigeo()!.code!,
      salesAssignment: this.assignVendorNow()
        ? {
            userId: this.vendor()!.id,
            weekdays: this.weekdays(),
            weeksOfCycle: this.weeks().length > 0 ? this.weeks() : null,
          }
        : null,
    };
  }

  protected submit() {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.banner.set('');
    this.bannerAction.set(null);
    this.fieldErrors.set({});
    this.codeFieldRequestId.set(null);
    this.customerSvc.create(this.buildCommand()).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.toast.success(`Cliente ${result.customer.code} creado`);
        if (result.approvedRequestId != null) {
          this.toast.info(
            `Se aprobó la solicitud de creación #${result.approvedRequestId} de ${result.approvedRequestRequestedByName}.`,
          );
        }
        this.router.navigate(['/clientes', result.customer.customerId]);
      },
      error: (err) => this.handleError(err),
    });
  }

  private handleError(err: {
    status?: number;
    error?: { detail?: string; message?: string; errors?: Record<string, string> };
  }) {
    this.saving.set(false);
    if (err?.status === 403) {
      this.toast.error('No tienes permiso para crear clientes');
      return;
    }
    if (err?.status === 404) {
      const msg = err?.error?.detail ?? '';
      if (msg.toLowerCase().includes('ubigeo')) {
        this.fieldErrors.update((e) => ({ ...e, ubigeoCode: msg }));
        return;
      }
      this.banner.set(msg || 'No pudimos crear el cliente.');
      return;
    }
    if (err?.status === 400 && err.error?.errors) {
      this.fieldErrors.set(err.error.errors);
      this.toast.error(err.error.detail || 'Revisa los campos marcados.');
      return;
    }
    const message = err?.error?.detail ?? err?.error?.message ?? 'No pudimos crear el cliente.';
    this.placeError(message);
  }

  /** Ubica el mensaje del backend bajo el campo correcto — doc 74, sección 5.1. */
  private placeError(message: string) {
    const m = message.toLowerCase();

    if (m.startsWith('el documento tiene una solicitud de creaci')) {
      const codeMatch = message.match(/con el c[oó]digo (\S+?)[:.,]/i);
      const code = codeMatch ? codeMatch[1] : '';
      this.banner.set(message);
      if (code) {
        this.bannerAction.set({
          label: `Usar código ${code}`,
          run: () => {
            this.customerCode.set(code);
            this.clearFieldError('customerCode');
            this.banner.set('');
            this.bannerAction.set(null);
          },
        });
      }
      return;
    }

    if (m.includes('ya lo tiene la solicitud de creaci')) {
      this.fieldErrors.update((e) => ({ ...e, customerCode: message }));
      const idMatch = message.match(/creaci[oó]n #(\d+)/i);
      this.codeFieldRequestId.set(idMatch ? Number(idMatch[1]) : null);
      return;
    }
    if (m.includes('código')) {
      this.fieldErrors.update((e) => ({ ...e, customerCode: message }));
      return;
    }
    if (m.includes('secuencia de ruta')) {
      this.fieldErrors.update((e) => ({ ...e, routeSequence: message }));
      return;
    }
    if (m.includes('razón social') || m.includes('razon social')) {
      this.fieldErrors.update((e) => ({ ...e, businessName: message }));
      return;
    }
    if (m.includes('tipo de documento')) {
      this.fieldErrors.update((e) => ({ ...e, documentTypeId: message }));
      return;
    }
    if (m.includes('tipo de cliente')) {
      this.fieldErrors.update((e) => ({ ...e, customerTypeId: message }));
      return;
    }
    if (m.includes('dirección') || m.includes('direccion')) {
      this.fieldErrors.update((e) => ({ ...e, address: message }));
      return;
    }
    if (m.includes('teléfono') || m.includes('telefono')) {
      this.fieldErrors.update((e) => ({ ...e, phone: message }));
      return;
    }
    if (m.includes('actividad')) {
      this.fieldErrors.update((e) => ({ ...e, businessActivity: message }));
      return;
    }
    if (m.includes('latitud')) {
      this.fieldErrors.update((e) => ({ ...e, latitude: message }));
      return;
    }
    if (m.includes('longitud')) {
      this.fieldErrors.update((e) => ({ ...e, longitude: message }));
      return;
    }
    if (m.includes('ubigeo')) {
      this.fieldErrors.update((e) => ({ ...e, ubigeoCode: message }));
      return;
    }
    if (m.includes('vendedor')) {
      this.fieldErrors.update((e) => ({ ...e, vendor: message }));
      return;
    }
    if (m.includes('documento')) {
      this.fieldErrors.update((e) => ({ ...e, documentNumber: message }));
      return;
    }
    this.banner.set(message);
  }

  protected goToApprovals() {
    this.router.navigate(['/aprobaciones']);
  }

  protected cancel() {
    if (!this.hasData()) {
      this.router.navigate(['/clientes']);
      return;
    }
    this.dialog
      .confirm({
        title: '¿Descartar el cliente nuevo?',
        message: 'Se perderán los datos ingresados.',
        confirmLabel: 'Descartar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.router.navigate(['/clientes']);
      });
  }
}
