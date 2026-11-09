import { Component, OnInit, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiField } from '../../../../shared/ui/field/field';
import { UiCheckbox } from '../../../../shared/ui/checkbox/checkbox';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiInfoTip } from '../../../../shared/ui/info-tip/info-tip';
import { UiDialogService } from '../../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../../core/ui/toast';
import { AuthService } from '../../../../core/auth/auth';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { GoodsReceiptsApi } from '../../data-access/goods-receipts.api';
import {
  BrandProductView,
  BrandReceiptConfigRow,
  EquivalenceView,
} from '../../domain/goods-receipt.models';
import { dateTimeText } from '../../../assignments/assignment-format';
import { AddEquivalenceDialog } from '../../dialogs/add-equivalence.dialog';
import { ChangeEquivalenceDialog } from '../../dialogs/change-equivalence.dialog';

type Tab = 'perfil' | 'equivalencias';

/**
 * Marca → Perfil · Equivalencias — doc 58, secciones 8.2 y 8.3. Pestañas por
 * `?tab=` (precedente: promo-detail.ts, doc 47). `goods_receipt.config` o
 * `.view` ve la pantalla; solo `.config` guarda perfil y edita equivalencias.
 */
@Component({
  selector: 'app-brand-config',
  imports: [UiButton, UiField, UiCheckbox, UiEmpty, UiInfoTip],
  template: `
    <section class="bc-page">
      <button type="button" class="bc-back" (click)="goBack()">← Configuración por marca</button>

      @if (loading()) {
        <div class="bc-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (notFound()) {
        <ui-empty title="No se encontró la marca" actionLabel="Volver" (action)="goBack()" />
      } @else if (row()) {
        <div class="bc-title-row">
          <h1>{{ row()!.brandName }} · {{ row()!.brandCode }}</h1>
          @if (row()!.configured) {
            <span class="bc-status-badge bc-status-configured">● Configurada</span>
          } @else {
            <span class="bc-status-badge bc-status-unconfigured">● Sin configurar</span>
          }
        </div>

        <nav class="bc-tabs">
          <button
            type="button"
            class="bc-tab"
            [class.active]="tab() === 'perfil'"
            (click)="setTab('perfil')"
          >
            Perfil
          </button>
          <button
            type="button"
            class="bc-tab"
            [class.active]="tab() === 'equivalencias'"
            (click)="setTab('equivalencias')"
          >
            Equivalencias ({{ row()!.activeEquivalences }})
          </button>
        </nav>

        @if (tab() === 'perfil') {
          <div class="bc-profile">
            <h2>Perfil de recepción</h2>
            <p class="bc-sub">
              Valores por defecto que la app muestra al elegir la marca. Almacén los puede cambiar
              en cada entrega.
            </p>

            <div class="bc-field">
              <label class="bc-label"
                >RUC del proveedor
                <span
                  uiInfoTip="Se compara con el RUC leído en cada documento para confirmar que la foto es de esta marca."
                ></span
              ></label>
              <ui-field label="" [(value)]="ruc" [error]="rucError()" [disabled]="!canConfig()" />
            </div>

            <div class="bc-radio-group">
              <span class="bc-label"
                >La planilla viene en
                <span
                  uiInfoTip="Si las cantidades del documento suelen estar en unidades o en paquetes."
                ></span
              ></span>
              <label class="bc-radio-option">
                <input
                  type="radio"
                  name="bc-unit-type"
                  [checked]="unitType() === 'UNIT'"
                  [disabled]="!canConfig()"
                  (change)="unitType.set('UNIT')"
                />
                Unidades
              </label>
              <label class="bc-radio-option">
                <input
                  type="radio"
                  name="bc-unit-type"
                  [checked]="unitType() === 'PACKAGE'"
                  [disabled]="!canConfig()"
                  (change)="unitType.set('PACKAGE')"
                />
                Paquetes
              </label>
            </div>
            <p class="bc-hint">
              Paquetes si la cantidad es por caja (unidad de medida CJ, PAQ; descripción con 12/1,
              18/1…).
            </p>

            <div>
              <ui-checkbox
                label="Precios · incluyen IGV"
                [(checked)]="pricesIncludeTax"
                [disabled]="!canConfig()"
              />
              <p class="bc-hint">Si el valor unitario impreso ya trae IGV.</p>
            </div>
            <div>
              <ui-checkbox
                label="Códigos de producto · la marca imprime el código en cada línea"
                [(checked)]="usesProductCodes"
                [disabled]="!canConfig()"
              />
              <p class="bc-hint">
                Solo si la factura imprime un código por línea. Yichang, por ejemplo, no: trae solo
                descripciones.
              </p>
            </div>

            @if (profileError()) {
              <div class="bc-error">{{ profileError() }}</div>
            }

            <div class="bc-profile-footer">
              <span class="bc-updated">
                @if (row()!.updatedByName) {
                  Última actualización: {{ row()!.updatedByName }} ·
                  {{ dateTimeText(row()!.updatedAt!) }}
                } @else {
                  Todavía no se guardó el perfil de esta marca.
                }
              </span>
              @if (canConfig()) {
                <button
                  uiButton
                  variant="primary"
                  [loading]="savingProfile()"
                  (click)="saveProfile()"
                >
                  {{ row()!.configured ? 'Actualizar perfil' : 'Guardar perfil' }}
                </button>
              }
            </div>
          </div>
        } @else {
          <div class="bc-equiv">
            <h2>Equivalencias</h2>
            <p class="bc-sub">
              Cómo nombra la marca cada producto. Se crean solas al confirmar entregas; aquí se
              corrigen.
            </p>

            <div class="bc-equiv-toolbar">
              <ui-field
                label="Buscar"
                icon="search"
                placeholder="Código, descripción o producto"
                [(value)]="equivSearch"
              />
              <ui-checkbox
                label="Ver desactivadas"
                [(checked)]="viewDeactivated"
                (checkedChange)="loadEquivalences()"
              />
              @if (canConfig()) {
                <button uiButton variant="secondary" (click)="openAddEquivalence()">
                  + Agregar equivalencia
                </button>
              }
            </div>

            @if (loadingEquiv()) {
              <div class="bc-skeleton" role="status" aria-label="Cargando"></div>
            } @else if (filteredEquivalences().length === 0) {
              <ui-empty
                title="Esta marca todavía no tiene equivalencias. Se crean solas al confirmar entregas."
              />
            } @else {
              <table class="ui-table-grid bc-equiv-table">
                <thead>
                  <tr>
                    <th>Código proveedor</th>
                    <th>Descripción proveedor</th>
                    <th>Producto Hispánica</th>
                    <th>Creada por</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of filteredEquivalences(); track e.equivalenceId) {
                    <tr [class.bc-row-inactive]="!e.active">
                      <td [class.bc-muted]="!e.supplierCode">
                        {{ e.supplierCode || '— por nombre —' }}
                      </td>
                      <td>{{ e.supplierDescription }}</td>
                      <td>{{ e.productCode }} {{ e.productName }}</td>
                      <td class="bc-muted">{{ e.createdByName }} · {{ shortDate(e.createdAt) }}</td>
                      <td class="bc-equiv-actions">
                        @if (!e.active) {
                          <span class="bc-badge-inactive">Desactivada</span>
                        } @else if (canConfig()) {
                          <button uiButton variant="ghost" size="sm" (click)="openChangeProduct(e)">
                            Cambiar producto
                          </button>
                          <button uiButton variant="ghost" size="sm" (click)="deactivate(e)">
                            Desactivar
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .bc-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .bc-back {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-weight: 700;
        font-size: 13px;
        color: var(--ink-muted);
        padding: 0;
        margin-bottom: 16px;
      }
      .bc-back:hover {
        color: var(--ink);
      }
      .bc-skeleton {
        height: 260px;
        background: var(--faint);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .bc-title-row {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      .bc-status-badge {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        white-space: nowrap;
      }
      .bc-status-configured {
        color: var(--st-vigente);
      }
      .bc-status-unconfigured {
        color: var(--st-closed);
      }
      h2 {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .bc-sub {
        margin: 0 0 20px;
        color: var(--ink-muted);
        font-size: 13px;
        max-width: 620px;
      }
      .bc-tabs {
        display: flex;
        gap: var(--sp-5);
        margin-top: var(--sp-5);
        margin-bottom: 24px;
        border-bottom: var(--border-rule);
      }
      .bc-tab {
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 14px;
        padding: var(--sp-3) 0;
        background: none;
        border: 0;
        border-bottom: 3px solid transparent;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .bc-tab:hover {
        color: var(--ink);
      }
      .bc-tab.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
      .bc-profile {
        max-width: 480px;
        display: grid;
        gap: 16px;
      }
      .bc-field {
        display: grid;
        gap: 4px;
      }
      .bc-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .bc-radio-group {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      .bc-radio-option {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--ink);
        cursor: pointer;
      }
      .bc-error {
        color: var(--st-mismatch);
        font-size: 13px;
      }
      .bc-hint {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bc-profile-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-top: 8px;
        padding-top: 16px;
        border-top: var(--border-hair);
      }
      .bc-updated {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bc-equiv-toolbar {
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .bc-equiv-toolbar ui-field {
        flex: 1;
        max-width: 320px;
      }
      .bc-equiv-table {
        width: 100%;
      }
      .bc-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .bc-row-inactive {
        opacity: 0.55;
      }
      .bc-equiv-actions {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
      }
      .bc-badge-inactive {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        color: var(--st-closed);
      }

      @media (max-width: 767px) {
        .bc-page {
          padding: var(--sp-4);
        }
        .bc-equiv-table {
          display: block;
          overflow-x: auto;
        }
      }
    `,
  ],
})
export class BrandConfigPage implements OnInit {
  private api = inject(GoodsReceiptsApi);
  private auth = inject(AuthService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  brandId = input.required<string>();

  protected dateTimeText = dateTimeText;
  protected canConfig = () => this.auth.hasAny(PERMISSIONS.GOODS_RECEIPT_CONFIG);

  protected loading = signal(true);
  protected notFound = signal(false);
  protected row = signal<BrandReceiptConfigRow | null>(null);

  protected tab = signal<Tab>(
    this.route.snapshot.queryParamMap.get('tab') === 'equivalencias' ? 'equivalencias' : 'perfil',
  );

  protected ruc = signal('');
  protected unitType = signal<'UNIT' | 'PACKAGE'>('UNIT');
  protected pricesIncludeTax = signal(false);
  protected usesProductCodes = signal(false);
  protected savingProfile = signal(false);
  protected profileSubmitted = signal(false);
  protected profileError = signal('');

  protected equivalences = signal<EquivalenceView[]>([]);
  protected loadingEquiv = signal(false);
  protected equivSearch = signal('');
  protected viewDeactivated = signal(false);
  protected brandProducts = signal<BrandProductView[]>([]);

  protected filteredEquivalences(): EquivalenceView[] {
    const q = this.equivSearch().trim().toLowerCase();
    if (!q) return this.equivalences();
    return this.equivalences().filter(
      (e) =>
        (e.supplierCode ?? '').toLowerCase().includes(q) ||
        (e.supplierDescription ?? '').toLowerCase().includes(q) ||
        e.productCode.toLowerCase().includes(q) ||
        e.productName.toLowerCase().includes(q),
    );
  }

  // No leer input.required() en el constructor (NG0950): el router todavía
  // no lo asignó. La primera carga se cuelga de ngOnInit — doc 62, sección 7.3.
  ngOnInit(): void {
    this.load();
  }

  private load() {
    const id = Number(this.brandId());
    this.loading.set(true);
    this.notFound.set(false);
    this.api.configBrands().subscribe({
      next: (list) => {
        const r = list.find((b) => b.brandId === id) ?? null;
        this.row.set(r);
        this.loading.set(false);
        if (!r) {
          this.notFound.set(true);
          return;
        }
        if (r.configured) {
          this.ruc.set(r.ruc ?? '');
          this.unitType.set(r.unitType ?? 'UNIT');
          this.pricesIncludeTax.set(r.pricesIncludeTax ?? false);
          this.usesProductCodes.set(r.usesProductCodes ?? false);
        }
        if (this.tab() === 'equivalencias') this.loadEquivalences();
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }

  protected setTab(tab: Tab) {
    this.tab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'equivalencias' ? 'equivalencias' : null },
      replaceUrl: true,
    });
    if (tab === 'equivalencias' && this.equivalences().length === 0) this.loadEquivalences();
  }

  protected rucError(): string {
    if (!this.profileSubmitted()) return '';
    return /^\d{11}$/.test(this.ruc().trim()) ? '' : 'El RUC debe tener 11 dígitos';
  }

  protected saveProfile() {
    this.profileSubmitted.set(true);
    this.profileError.set('');
    if (this.rucError()) return;

    this.savingProfile.set(true);
    this.api
      .upsertProfile(Number(this.brandId()), {
        ruc: this.ruc().trim(),
        unitType: this.unitType(),
        pricesIncludeTax: this.pricesIncludeTax(),
        usesProductCodes: this.usesProductCodes(),
      })
      .subscribe({
        next: (profile) => {
          this.savingProfile.set(false);
          this.toast.success('Perfil guardado');
          this.row.update((r) =>
            r
              ? {
                  ...r,
                  configured: true,
                  ruc: profile.ruc,
                  unitType: profile.unitType,
                  pricesIncludeTax: profile.pricesIncludeTax,
                  usesProductCodes: profile.usesProductCodes,
                  updatedByName: profile.updatedByName,
                  updatedAt: profile.updatedAt,
                }
              : r,
          );
        },
        error: (err) => {
          this.savingProfile.set(false);
          const body = err?.error;
          this.profileError.set(
            body?.errors?.ruc ||
              body?.errors?.unitType ||
              body?.detail ||
              'No pudimos guardar el perfil.',
          );
        },
      });
  }

  protected loadEquivalences() {
    this.loadingEquiv.set(true);
    this.api.equivalences(Number(this.brandId()), !this.viewDeactivated()).subscribe({
      next: (list) => {
        this.equivalences.set(list);
        this.loadingEquiv.set(false);
      },
      error: () => this.loadingEquiv.set(false),
    });
  }

  private ensureProducts(cb: (products: BrandProductView[]) => void) {
    if (this.brandProducts().length > 0) {
      cb(this.brandProducts());
      return;
    }
    this.api.brandContext(Number(this.brandId())).subscribe({
      next: (ctx) => {
        this.brandProducts.set(ctx.products);
        cb(ctx.products);
      },
      error: () => this.toast.error('No pudimos cargar los productos de la marca.'),
    });
  }

  protected openAddEquivalence() {
    this.ensureProducts((products) => {
      this.dialog
        .open(AddEquivalenceDialog, {
          data: { brandId: Number(this.brandId()), products },
          width: '520px',
        })
        .afterClosed()
        .subscribe((result) => {
          if (result) {
            this.toast.success('Equivalencia agregada');
            this.loadEquivalences();
          }
        });
    });
  }

  protected openChangeProduct(e: EquivalenceView) {
    this.ensureProducts((products) => {
      this.dialog
        .open(ChangeEquivalenceDialog, { data: { equivalence: e, products }, width: '480px' })
        .afterClosed()
        .subscribe((result) => {
          if (result) {
            this.toast.success('Producto cambiado');
            this.loadEquivalences();
          }
        });
    });
  }

  protected deactivate(e: EquivalenceView) {
    this.dialog
      .confirm({
        title: 'Desactivar equivalencia',
        message:
          '¿Desactivar esta equivalencia? Las próximas planillas ya no la usarán para emparejar.',
        confirmLabel: 'Desactivar',
        destructive: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deactivateEquivalence(e.equivalenceId).subscribe({
          next: () => {
            this.toast.success('Equivalencia desactivada');
            this.loadEquivalences();
          },
          error: () => this.toast.error('No pudimos desactivar la equivalencia.'),
        });
      });
  }

  protected shortDate(iso: string): string {
    return dateTimeText(iso).replace(/^(\d{2}\/\d{2})\/\d{4}/, '$1');
  }

  protected goBack() {
    this.router.navigate(['/recepcion-mercaderia/configuracion']);
  }
}
