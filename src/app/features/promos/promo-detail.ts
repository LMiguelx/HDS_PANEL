import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { differenceInCalendarDays, format, isBefore, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { UiButton } from '../../shared/ui/button/button';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiMenu } from '../../shared/ui/menu/menu';
import { UiCard } from '../../shared/ui/card/card';
import { UiBadge } from '../../shared/ui/badge/badge';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { ToastService } from '../../core/ui/toast';
import { PromoRuleCard } from './ui/promo-rule-card';
import { PromoConditionsTable } from './ui/promo-conditions-table';
import { PromoTiersTable } from './ui/promo-tiers-table';
import { PromoConfigList, PromoConfigRow } from './ui/promo-config-list';
import { PromoTargetsBlock } from './ui/promo-targets-block';
import { PromoReachTab } from './promo-reach-tab';
import { PromoService } from './promo';
import { PromoDetail } from './promo.types';
import {
  applicationsPerCustomerText,
  dateText,
  priorityText,
  promoStatusLabel,
  repeatsText,
  vigenciaFullText,
} from './promo-format';
import { dateTimeText } from '../assignments/assignment-format';
import { EditBasicsDialog, EditBasicsDialogResult } from './ui/edit-basics-dialog';
import { formatSoles } from '../../shared/pipes/money';
import { quantityText } from '../sales-reports/sales-report-format';

@Component({
  selector: 'app-promo-detail',
  imports: [
    RouterLink,
    UiButton,
    UiStatus,
    UiEmpty,
    UiMenu,
    UiCard,
    UiBadge,
    HasPermissionDirective,
    PromoRuleCard,
    PromoConditionsTable,
    PromoTiersTable,
    PromoConfigList,
    PromoTargetsBlock,
    PromoReachTab,
  ],
  template: `
    <section class="pd-page">
      @if (loading()) {
        <div class="pd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar la promoción"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (promo(); as p) {
        <div class="pd-head">
          <div>
            <a routerLink="/promociones" class="pd-eyebrow">← Promociones · {{ p.code }}</a>
            <div class="pd-title-row">
              <h1>{{ p.name }}</h1>
              <ui-status [label]="statusLabel(p)" />
              @if (p.featured) {
                <ui-badge tone="accent" class="pd-featured-badge"
                  ><span class="material-icons" aria-hidden="true">star</span> Destacada</ui-badge
                >
              }
            </div>
            <p class="pd-meta">{{ metaLine(p) }}</p>
            @if (p.description) {
              <p class="pd-description">
                <span class="material-icons" aria-hidden="true">chat_bubble_outline</span>
                Texto para el vendedor: {{ p.description }}
              </p>
            }
          </div>
          <div class="pd-actions">
            <button
              uiButton
              variant="secondary"
              *hasPermission="'order.manage'"
              [routerLink]="['/promociones/simular']"
              [queryParams]="{ promoId: p.promoId }"
            >
              Simular pedido
            </button>
            <button
              uiButton
              variant="secondary"
              *hasPermission="'promo.create'"
              (click)="duplicate()"
            >
              Duplicar
            </button>
            <button uiButton variant="primary" *hasPermission="'promo.create'" (click)="edit(p)">
              Editar
            </button>
            <ui-menu label="Más acciones">
              <button type="button" *hasPermission="'promo.create'" (click)="toggleFeatured(p)">
                {{ p.featured ? 'Quitar de destacadas' : 'Destacar en la app' }}
              </button>
              @if (!p.active) {
                <button type="button" *hasPermission="'promo.approve'" (click)="activate()">
                  Encender
                </button>
              } @else {
                <button type="button" *hasPermission="'promo.approve'" (click)="deactivate()">
                  Apagar
                </button>
              }
              @if (p.usage.orderCount === 0) {
                <button type="button" *hasPermission="'promo.create'" (click)="remove()">
                  Borrar
                </button>
              }
            </ui-menu>
          </div>
        </div>

        @if (deleteError()) {
          <div class="pd-error">{{ deleteError() }}</div>
        }

        <nav class="pd-tabs" *hasPermission="'promo.create'">
          <button
            type="button"
            class="pd-tab"
            [class.active]="activeTab() === 'resumen'"
            (click)="setTab('resumen')"
          >
            Resumen
          </button>
          <button
            type="button"
            class="pd-tab"
            [class.active]="activeTab() === 'alcance'"
            (click)="setTab('alcance')"
          >
            Alcance
          </button>
        </nav>

        @if (activeTab() === 'alcance') {
          <app-promo-reach-tab
            [promoId]="p.promoId!"
            [initialFrom]="initialFrom()"
            [initialTo]="initialTo()"
          />
        } @else {
          <div class="pd-usage">
            <div class="pd-usage-cell">
              <span class="pd-usage-label">Pedidos</span>
              <span class="pd-usage-value">{{ p.usage.orderCount }}</span>
              <span class="pd-usage-caption">no anulados</span>
            </div>
            <div class="pd-usage-cell">
              <span class="pd-usage-label">Unidades bonificadas</span>
              <span class="pd-usage-value">{{ quantityText(p.usage.grantedUnits) }}</span>
              <span class="pd-usage-caption">productos gratis entregados</span>
            </div>
            <div class="pd-usage-cell">
              <span class="pd-usage-label">Descuentos</span>
              <span class="pd-usage-value">{{ formatSoles(p.usage.discountAmount) }}</span>
              <span class="pd-usage-caption">en soles</span>
            </div>
            <div class="pd-usage-cell">
              <span class="pd-usage-label">Última aplicación</span>
              <span class="pd-usage-value pd-usage-value-sm">
                {{
                  p.usage.lastAppliedAt
                    ? dateTimeText(p.usage.lastAppliedAt)
                    : 'Todavía no se aplicó'
                }}
              </span>
            </div>
          </div>

          <div class="pd-grid">
            <div class="pd-main">
              <ui-card title="La regla">
                <app-promo-rule-card [source]="p" />
              </ui-card>

              <ui-card>
                <div class="pd-card-head">
                  <h3 class="pd-card-title">
                    Qué debe comprar
                    @if (p.conditions?.length) {
                      <ui-badge tone="neutral"
                        >{{ p.conditions!.length }} producto{{
                          p.conditions!.length === 1 ? '' : 's'
                        }}</ui-badge
                      >
                    }
                  </h3>
                  @if (showSumNote(p)) {
                    <span class="pd-card-note">+ Las cantidades se suman entre sí</span>
                  }
                </div>
                <app-promo-conditions-table [conditions]="p.conditions" [promoType]="p.promoType" />
              </ui-card>

              <ui-card>
                <div class="pd-card-head">
                  <h3 class="pd-card-title">
                    Tramos y premios
                    @if (p.tiers?.length) {
                      <ui-badge tone="neutral"
                        >{{ p.tiers!.length }} tramo{{ p.tiers!.length === 1 ? '' : 's' }}</ui-badge
                      >
                    }
                  </h3>
                  <span class="pd-card-note">Se mide en {{ measureLabel(p) }}</span>
                </div>
                <app-promo-tiers-table
                  [tiers]="p.tiers"
                  [measureType]="p.measureType"
                  [promoType]="p.promoType"
                />
              </ui-card>
            </div>

            <div class="pd-side">
              <div class="pd-edit-status" [class.pd-edit-ok]="p.definitionEditable">
                <span class="material-icons" aria-hidden="true">{{
                  p.definitionEditable ? 'task_alt' : 'info'
                }}</span>
                <div class="pd-edit-status-body">
                  @if (p.definitionEditable) {
                    <strong>Se puede editar todo</strong>
                    <p>
                      Todavía no se aplicó en pedidos. Los cambios valen para los pedidos nuevos.
                    </p>
                  } @else {
                    <p>{{ p.editBlockReason }}</p>
                    <button
                      uiButton
                      variant="secondary"
                      size="sm"
                      *hasPermission="'promo.create'"
                      (click)="duplicate()"
                    >
                      Duplicar
                    </button>
                  }
                </div>
              </div>

              <ui-card title="Vigencia">
                <div class="pd-vigencia-dates">
                  <span>{{ p.startDate ? dateText(p.startDate) : 'Sin fecha de inicio' }}</span>
                  <span>{{ p.endDate ? dateText(p.endDate) : 'Sin fecha de fin' }}</span>
                </div>
                @if (vigenciaPercent(p); as percent) {
                  <div class="pd-vigencia-track">
                    <div class="pd-vigencia-fill" [style.width.%]="percent"></div>
                  </div>
                }
                <p class="pd-vigencia-status">{{ vigenciaStatusText(p) }}</p>
              </ui-card>

              <ui-card title="Configuración">
                <app-promo-config-list [rows]="configRows(p)" />
              </ui-card>

              <ui-card title="A quiénes llega">
                <app-promo-targets-block
                  [segments]="p.segments"
                  [customers]="p.customers"
                  [salesChannelName]="p.salesChannelName"
                />
              </ui-card>
            </div>
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .pd-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .pd-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .pd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-6);
        flex-wrap: wrap;
      }
      .pd-eyebrow {
        display: inline-block;
        margin: 0;
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        text-decoration: none;
      }
      .pd-eyebrow:hover {
        color: var(--accent-ink);
      }
      .pd-title-row {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        flex-wrap: wrap;
      }
      .pd-featured-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .pd-featured-badge .material-icons {
        font-size: 13px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 4px 0 0;
        color: var(--ink);
      }
      .pd-meta {
        margin: 4px 0 0;
        color: var(--ink-muted);
        font-size: var(--fs-body);
      }
      .pd-description {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        margin: var(--sp-2) 0 0;
        font-size: var(--fs-dense);
        color: var(--ink-muted);
        max-width: 640px;
      }
      .pd-description .material-icons {
        font-size: 16px;
        margin-top: 1px;
      }
      .pd-actions {
        display: flex;
        gap: var(--sp-2);
        flex-wrap: wrap;
      }
      .pd-error {
        margin-top: var(--sp-3);
        color: var(--status-danger);
        font-size: var(--fs-dense);
      }
      .pd-tabs {
        display: flex;
        gap: var(--sp-5);
        margin-top: var(--sp-5);
        border-bottom: var(--border-rule);
      }
      .pd-tab {
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
      .pd-tab:hover {
        color: var(--ink);
      }
      .pd-tab.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
      .pd-usage {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        margin-top: var(--sp-5);
        background: var(--surface);
        border: 2px solid var(--divider);
        border-radius: var(--radius-card);
      }
      .pd-usage-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--sp-4) var(--sp-5);
        border-right: 1px solid var(--hairline);
      }
      .pd-usage-cell:last-child {
        border-right: 0;
      }
      .pd-usage-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        order: -1;
      }
      .pd-usage-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .pd-usage-value-sm {
        font-size: var(--fs-h2);
        font-weight: 700;
      }
      .pd-usage-caption {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .pd-grid {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: var(--sp-6);
        align-items: start;
        margin-top: var(--sp-5);
      }
      .pd-main {
        display: grid;
        gap: var(--sp-5);
        min-width: 0;
      }
      .pd-side {
        display: grid;
        gap: var(--sp-5);
        position: sticky;
        top: var(--sp-6);
      }
      .pd-card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--sp-3);
        flex-wrap: wrap;
        margin-bottom: var(--sp-4);
      }
      .pd-card-title {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        color: var(--ink);
        margin: 0;
      }
      .pd-card-note {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .pd-edit-status {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-3);
        padding: var(--sp-4);
        border-radius: var(--radius-card);
        border: 1px solid color-mix(in srgb, var(--status-warn) 40%, var(--hairline));
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
        color: var(--ink);
      }
      .pd-edit-status .material-icons {
        color: var(--status-warn);
        font-size: 20px;
      }
      .pd-edit-status-body strong {
        display: block;
        margin-bottom: 2px;
      }
      .pd-edit-status-body p {
        margin: 0;
        font-size: var(--fs-dense);
        color: var(--ink-muted);
      }
      .pd-edit-status-body button {
        margin-top: var(--sp-3);
      }
      .pd-edit-ok {
        border-color: color-mix(in srgb, var(--status-ok) 40%, var(--hairline));
        background: color-mix(in srgb, var(--status-ok) 10%, transparent);
      }
      .pd-edit-ok .material-icons {
        color: var(--status-ok);
      }
      .pd-vigencia-dates {
        display: flex;
        justify-content: space-between;
        font-size: var(--fs-dense);
        font-weight: 700;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .pd-vigencia-track {
        height: 6px;
        border-radius: var(--radius-pill);
        background: var(--surface-sunk);
        margin-top: var(--sp-3);
        overflow: hidden;
      }
      .pd-vigencia-fill {
        height: 100%;
        background: var(--status-ok);
      }
      .pd-vigencia-status {
        margin: var(--sp-2) 0 0;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }

      @media (max-width: 900px) {
        .pd-grid {
          grid-template-columns: 1fr;
        }
        .pd-side {
          position: static;
        }
      }

      @media (max-width: 767px) {
        .pd-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class PromoDetailPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private promoSvc = inject(PromoService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected dateText = dateText;
  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;
  protected quantityText = quantityText;

  protected promo = signal<PromoDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected deleteError = signal('');

  /** Pestañas Resumen/Alcance — doc 47, sección 10. `?tab=alcance` entra directo (desde Comparar promociones). */
  protected activeTab = signal<'resumen' | 'alcance'>('resumen');
  protected initialFrom = signal<string | null>(null);
  protected initialTo = signal<string | null>(null);

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('tab') === 'alcance') this.activeTab.set('alcance');
    this.initialFrom.set(qp.get('from'));
    this.initialTo.set(qp.get('to'));
    this.load();
  }

  protected setTab(tab: 'resumen' | 'alcance') {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'alcance' ? 'alcance' : null },
      queryParamsHandling: 'merge',
    });
  }

  load() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set(false);
    this.promoSvc.detail(id).subscribe({
      next: (p) => {
        this.promo.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected statusLabel(p: PromoDetail): string {
    return promoStatusLabel(p);
  }

  protected metaLine(p: PromoDetail): string {
    const parts = [
      p.promoTypeName || p.promoType,
      p.salesChannelName ? `Canal ${p.salesChannelName}` : 'Todos los canales',
      vigenciaFullText(p.startDate, p.endDate),
      `Prioridad ${priorityText(p.priority)}`,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  protected measureLabel(p: PromoDetail): string {
    return p.measureType === 'AMOUNT' ? 'monto (S/)' : 'unidades';
  }

  protected showSumNote(p: PromoDetail): boolean {
    const conditions = p.conditions ?? [];
    return conditions.length > 1 || conditions.some((c) => c.scope !== 'PRODUCT');
  }

  protected configRows(p: PromoDetail): PromoConfigRow[] {
    return [
      { label: 'Tipo', value: p.promoTypeName || p.promoType || '—' },
      { label: 'Canal', value: p.salesChannelName ?? 'Todos los canales' },
      { label: 'Se mide en', value: p.measureType === 'AMOUNT' ? 'Monto (S/)' : 'Unidades' },
      { label: 'Prioridad', value: priorityText(p.priority) },
      {
        label: 'Destacada en la app',
        value: p.featured ? 'Sí' : 'No',
        hint: 'Solo cambia lo que el vendedor ve primero; no cambia cómo se aplica.',
      },
      { label: 'Se combina con otras', value: p.stackable ? 'Sí' : 'No' },
      { label: 'Se repite por múltiplos', value: repeatsText(p.repeats, p.maxRepeatsPerOrder) },
      {
        label: 'Veces por cliente',
        value: applicationsPerCustomerText(p.maxApplicationsPerCustomer),
      },
    ];
  }

  /** Porcentaje de avance de la vigencia; `null` cuando no hay fecha de fin (sin barra). */
  protected vigenciaPercent(p: PromoDetail): number | null {
    if (!p.endDate) return null;
    const today = startOfDay(new Date());
    const end = startOfDay(parseISO(p.endDate));
    const start = p.startDate ? startOfDay(parseISO(p.startDate)) : end;
    if (isBefore(today, start)) return 0;
    if (isBefore(end, today)) return 100;
    if (end.getTime() === start.getTime()) return 100;
    return Math.round(
      ((today.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100,
    );
  }

  protected vigenciaStatusText(p: PromoDetail): string {
    if (!p.endDate) return 'Sin fecha de fin';
    const today = startOfDay(new Date());
    const end = startOfDay(parseISO(p.endDate));
    if (p.startDate) {
      const start = startOfDay(parseISO(p.startDate));
      if (isBefore(today, start)) {
        const days = differenceInCalendarDays(start, today);
        return `Empieza en ${days} día${days === 1 ? '' : 's'}`;
      }
    }
    if (isBefore(end, today)) {
      return `Venció el ${dateText(p.endDate)}`;
    }
    const daysLeft = differenceInCalendarDays(end, today);
    const weekday = format(end, 'EEEE', { locale: es });
    return `Quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'} · termina el ${weekday}`;
  }

  protected duplicate() {
    const id = this.promo()?.promoId;
    this.router.navigate(['/promociones/nueva'], { queryParams: { duplicateFrom: id } });
  }

  protected edit(p: PromoDetail) {
    if (p.definitionEditable) {
      this.router.navigate(['/promociones', p.promoId, 'editar']);
      return;
    }
    this.dialog
      .open<EditBasicsDialog, PromoDetail, EditBasicsDialogResult>(EditBasicsDialog, { data: p })
      .afterClosed()
      .subscribe((result) => {
        if (result === 'duplicate') {
          this.duplicate();
        } else if (result) {
          this.promo.set(result);
        }
      });
  }

  protected activate() {
    const id = this.promo()?.promoId;
    if (!id) return;
    this.promoSvc.approve(id).subscribe(() => this.load());
  }

  protected deactivate() {
    const id = this.promo()?.promoId;
    if (!id) return;
    this.promoSvc.deactivate(id).subscribe(() => this.load());
  }

  /** Destacar/quitar de destacadas — doc 49, sección 6.2: PATCH basics con name/endDate/priority tal cual y featured invertido. */
  protected toggleFeatured(p: PromoDetail) {
    const next = !p.featured;
    const apply = () => {
      this.promoSvc
        .updateBasics(p.promoId!, {
          name: p.name ?? '',
          endDate: p.endDate ?? null,
          priority: p.priority ?? 100,
          featured: next,
        })
        .subscribe({
          next: (updated) => {
            this.promo.set(updated);
            this.toast.success(next ? 'Promoción destacada' : 'Se quitó de destacadas');
          },
          error: (err) => {
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.toast.error(detalle || 'No pudimos guardar los cambios.');
          },
        });
    };
    if (next && p.active) {
      this.dialog
        .confirm({
          title: 'Destacar en la app',
          message:
            'El vendedor verá esta promoción entre las primeras al atender a sus clientes. ¿Destacar?',
          confirmLabel: 'Destacar',
        })
        .subscribe((confirmed) => {
          if (confirmed) apply();
        });
      return;
    }
    apply();
  }

  protected remove() {
    const id = this.promo()?.promoId;
    if (!id) return;
    this.dialog
      .confirm({
        title: 'Borrar promoción',
        message: '¿Borrar esta promoción? Esta acción no se puede deshacer.',
        confirmLabel: 'Borrar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deleteError.set('');
        this.promoSvc.remove(id).subscribe({
          next: () => this.router.navigate(['/promociones']),
          error: (err) => {
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.deleteError.set(
              detalle || 'No pudimos borrar la promoción: ya se aplicó en algún pedido.',
            );
          },
        });
      });
  }
}
