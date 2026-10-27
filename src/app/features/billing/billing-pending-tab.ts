import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { LookupService, toUiLookup } from '../promos/lookup';
import { OrderAdminService } from '../orders/order-admin';
import { BillingValidationAdminService } from './billing-validation-admin';
import { BillingValidationModuleTabs } from './ui/billing-module-tabs';
import { AdminOrderSummary } from '../../shared/models/order.models';
import {
  BillingIssue,
  OrderBillingSendOutcome,
  OrderBillingValidation,
} from '../../shared/models/billing-validation.models';
import { originName } from '../orders/order-format';
import { elsewhereLinkFor, hasRecalcFix as issuesHaveRecalcFix } from './billing-validation-format';
import { dateTimeText, timeText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Phase = 'browse' | 'validating' | 'results' | 'sending' | 'sent';
type ShowFilter = 'issues' | 'valid' | 'all';

const VALIDATE_CHUNK = 200;
const SEND_CHUNK = 100;

/**
 * Validación de pedidos — "Por enviar" (doc 32, secciones 5 a 8). Reúne en
 * una sola pantalla: el listado de abiertos del día, validarlos (todos o
 * los marcados), corregirlos y enviar los válidos a facturación.
 */
@Component({
  selector: 'app-billing-pending-tab',
  imports: [RouterLink, UiButton, UiField, UiTypeahead, UiEmpty, BillingValidationModuleTabs],
  template: `
    <app-billing-validation-module-tabs />
    <section class="bpt-page">
      @if (phase() === 'browse') {
        <div class="bpt-head">
          <div>
            <h1>Validación de pedidos</h1>
            <p class="bpt-sub">Pedidos abiertos del {{ dayLongText() }}</p>
          </div>
          <div class="bpt-toolbar-actions">
            <button
              uiButton
              variant="secondary"
              [disabled]="selectedCount() === 0"
              (click)="validateSelected()"
            >
              Validar seleccionados ({{ selectedCount() }})
            </button>
            <button
              uiButton
              variant="primary"
              [disabled]="totalElements() === 0"
              (click)="validateAllDay()"
            >
              Validar todos
            </button>
          </div>
        </div>

        <div class="bpt-info-banner">
          <span class="material-icons" aria-hidden="true">info</span>
          <span
            >Validar revisa el pedido, el cliente y vendedor, los productos, los precios, los
            totales y las promociones antes de dejarlos listos para enviar.</span
          >
        </div>

        <div class="bpt-stat-cards">
          <div class="bpt-stat-card">
            <span class="bpt-stat-label">Pedidos abiertos</span>
            <span class="bpt-stat-value">{{ totalElements() }}</span>
          </div>
          <div class="bpt-stat-card">
            <span class="bpt-stat-label">Seleccionados</span>
            <span class="bpt-stat-value">{{ selectedCount() }}</span>
            <span class="bpt-stat-sub">{{ formatSoles(selectedNetTotal()) }}</span>
          </div>
          <div class="bpt-stat-card">
            <span class="bpt-stat-label">Neto por validar</span>
            <span class="bpt-stat-value">{{ formatSoles(pageNetTotal()) }}</span>
          </div>
        </div>

        <div class="bpt-filters">
          <ui-field label="Fecha" type="date" [(value)]="dayFilter" />
          <ui-typeahead
            label="Vendedor"
            placeholder="Todos"
            [clearOnPick]="false"
            [search]="userSearch"
            [(selected)]="vendorFilter"
          />
          <ui-field
            label="Buscar"
            icon="search"
            placeholder="Cliente o número de pedido"
            [(value)]="searchQuery"
          />
        </div>

        @if (loading()) {
          <div class="bpt-skeleton" role="status" aria-label="Cargando"></div>
        } @else if (error()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar los pedidos"
            body="Intenta de nuevo en unos segundos."
            actionLabel="Reintentar"
            (action)="load()"
          />
        } @else if (rows().length === 0) {
          <ui-empty title="Sin pedidos abiertos" body="No hay pedidos abiertos en esta fecha." />
        } @else if (filteredRows().length === 0) {
          <ui-empty
            title="Sin resultados"
            body="Prueba con otro texto de búsqueda."
            actionLabel="Limpiar búsqueda"
            (action)="searchQuery.set('')"
          />
        } @else {
          <table class="ui-table-grid bpt-table-desktop">
            <thead>
              <tr>
                <th class="bpt-check-cell">
                  <input
                    type="checkbox"
                    [checked]="allPageSelected()"
                    (change)="toggleSelectPage($event)"
                  />
                </th>
                <th>N.º</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Hora</th>
                <th>Origen</th>
                <th>Neto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of filteredRows(); track o.orderId) {
                <tr class="bpt-order-row" (click)="toggleSelect(o)">
                  <td class="bpt-check-cell" (click)="$event.stopPropagation()">
                    <input
                      type="checkbox"
                      [checked]="selectedIds().has(o.orderId)"
                      (change)="toggleSelect(o)"
                    />
                  </td>
                  <td class="bpt-cell-strong">{{ o.orderId }}</td>
                  <td>{{ o.customerName }}</td>
                  <td class="bpt-muted">{{ o.salespersonName }}</td>
                  <td class="bpt-muted">{{ timeText(o.orderDate) }}</td>
                  <td class="bpt-muted">
                    <span class="bpt-origin-pill">{{ originName(o.originCode) }}</span>
                  </td>
                  <td class="bpt-cell-strong">{{ formatSoles(o.netAmount) }}</td>
                  <td class="bpt-chevron">›</td>
                </tr>
              }
            </tbody>
          </table>

          <div class="bpt-cards-mobile">
            @for (o of filteredRows(); track o.orderId) {
              <label class="bpt-card-mobile">
                <input
                  type="checkbox"
                  [checked]="selectedIds().has(o.orderId)"
                  (change)="toggleSelect(o)"
                />
                <div>
                  <div class="bpt-card-mobile-head">
                    <span class="bpt-card-mobile-name">#{{ o.orderId }} {{ o.customerName }}</span>
                    <span class="bpt-cell-strong">{{ formatSoles(o.netAmount) }}</span>
                  </div>
                  <div class="bpt-muted">
                    {{ o.salespersonName }} · {{ timeText(o.orderDate) }} ·
                    {{ originName(o.originCode) }}
                  </div>
                </div>
              </label>
            }
          </div>

          <div class="bpt-pager">
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() === 0"
              (click)="prevPage()"
            >
              Anterior
            </button>
            <span class="bpt-pager-label"
              >Página {{ page() + 1 }} de {{ totalPages() || 1 }} · {{ countText() }}</span
            >
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() + 1 >= totalPages()"
              (click)="nextPage()"
            >
              Siguiente
            </button>
            <span class="bpt-pager-total">Total neto {{ formatSoles(pageNetTotal()) }}</span>
          </div>
        }
      }

      @if (phase() === 'validating') {
        <div class="bpt-progress-block">
          <div class="bpt-progress-head">
            <span>Validando {{ validatedSoFar() }} de {{ totalToValidate() }} pedidos…</span>
            <button uiButton variant="ghost" size="sm" (click)="cancelValidation()">
              Cancelar
            </button>
          </div>
          <div class="bpt-progress-track">
            <div class="bpt-progress-fill" [style.width.%]="validatingPct()"></div>
          </div>
          <p class="bpt-muted">{{ validCount() }} válidos · {{ invalidCount() }} con motivos</p>
        </div>
      }

      @if (phase() === 'results') {
        <div class="bpt-head">
          <div>
            <h1>Resultado de la validación</h1>
            <p class="bpt-sub">{{ dayLongText() }}</p>
          </div>
          <button uiButton variant="secondary" (click)="backToBrowse()">
            <span class="material-icons" aria-hidden="true">refresh</span>
            Validar de nuevo
          </button>
        </div>

        @if (notFoundCount() > 0) {
          <p class="bpt-notice">
            {{ notFoundCount() }} pedido{{ notFoundCount() === 1 ? '' : 's' }} ya no
            {{ notFoundCount() === 1 ? 'está disponible' : 'están disponibles' }}.
          </p>
        }

        @if (invalidCount() === 0) {
          <div class="bpt-ok-banner">
            <span class="material-icons" aria-hidden="true">check_circle</span>
            <div>
              <strong>Todo en orden</strong>
              <div>
                Los {{ validCount() }} pedido{{ validCount() === 1 ? '' : 's' }} pasaron las 6
                validaciones y {{ validCount() === 1 ? 'está listo' : 'están listos' }} para enviar.
              </div>
            </div>
          </div>
        } @else {
          <div class="bpt-warn-banner">
            <span class="material-icons" aria-hidden="true">warning</span>
            <div class="bpt-warn-banner-text">
              <strong
                >{{ invalidCount() }} pedido{{ invalidCount() === 1 ? '' : 's' }} con
                motivos</strong
              >
              <div>
                @if (eligibleForRecalc().length > 0) {
                  {{ eligibleForRecalc().length }} se corrige{{
                    eligibleForRecalc().length === 1 ? '' : 'n'
                  }}
                  recalculando el pedido.
                } @else {
                  Revísalos uno por uno abajo.
                }
              </div>
            </div>
            @if (eligibleForRecalc().length > 0) {
              <button
                uiButton
                variant="secondary"
                size="sm"
                [loading]="recalculatingAll()"
                (click)="recalculateAllPending()"
              >
                Recalcular pendientes ({{ eligibleForRecalc().length }})
              </button>
            }
          </div>
        }

        @if (recalculatingAll()) {
          <div class="bpt-progress-block">
            <div class="bpt-progress-head">
              <span
                >Recalculando {{ recalculateAllProgress().done }} de
                {{ recalculateAllProgress().total }} pedidos…</span
              >
            </div>
            <div class="bpt-progress-track">
              <div class="bpt-progress-fill" [style.width.%]="recalculateAllPct()"></div>
            </div>
          </div>
        }

        <div class="bpt-summary-row">
          <div class="bpt-summary-card">
            <span class="bpt-summary-value">{{ validatedTotal() }}</span>
            <span class="bpt-summary-label">Validados</span>
          </div>
          <div class="bpt-summary-card">
            <span class="bpt-summary-value">{{ validCount() }}</span>
            <span class="bpt-summary-label">Válidos</span>
          </div>
          <div class="bpt-summary-card bpt-summary-card-warn">
            <span class="bpt-summary-value">{{ invalidCount() }}</span>
            <span class="bpt-summary-label">Con motivos</span>
          </div>
        </div>

        <div class="bpt-show-filter">
          <button
            type="button"
            class="bpt-chip"
            [class.on]="showFilter() === 'issues'"
            (click)="showFilter.set('issues')"
          >
            Con motivos <span class="bpt-chip-count">{{ invalidCount() }}</span>
          </button>
          <button
            type="button"
            class="bpt-chip"
            [class.on]="showFilter() === 'valid'"
            (click)="showFilter.set('valid')"
          >
            Válidos <span class="bpt-chip-count">{{ validCount() }}</span>
          </button>
          <button
            type="button"
            class="bpt-chip"
            [class.on]="showFilter() === 'all'"
            (click)="showFilter.set('all')"
          >
            Todos <span class="bpt-chip-count">{{ validatedTotal() }}</span>
          </button>
        </div>

        @if (filteredValidationOrders().length === 0) {
          <ui-empty
            variant="al-dia"
            eyebrow="Al día"
            title="Nada que mostrar con este filtro"
            body="Prueba con otro filtro de arriba."
          />
        } @else {
          <div class="bpt-result-list">
            @for (o of filteredValidationOrders(); track o.orderId) {
              <div class="bpt-result-row">
                <div class="bpt-result-summary">
                  <button
                    type="button"
                    class="bpt-expand-btn"
                    (click)="toggleExpand(o.orderId)"
                    [attr.aria-label]="
                      expandedIds().has(o.orderId) ? 'Ocultar detalle' : 'Ver detalle'
                    "
                  >
                    <span class="bpt-expand-arrow">{{
                      expandedIds().has(o.orderId) ? '▾' : '▸'
                    }}</span>
                    <span class="bpt-cell-strong">{{ o.orderId }}</span>
                  </button>
                  <div class="bpt-result-customer">
                    <div>{{ o.customerName }}</div>
                    <div class="bpt-checks-sub" [class.fail]="!o.valid">
                      {{ o.valid ? '✓' : '✗' }} {{ passedChecksCount(o) }}/{{ o.checks.length }}
                      validaciones
                    </div>
                  </div>
                  <span class="bpt-muted bpt-result-zone">{{ o.salespersonName }}</span>
                  <span class="bpt-cell-strong">{{ formatSoles(o.netAmount) }}</span>
                  @if (o.valid) {
                    <span class="bpt-badge bpt-badge-ok">● Válido</span>
                  } @else {
                    <span class="bpt-badge bpt-badge-warn"
                      >● Con motivos ({{ o.issues.length }})</span
                    >
                  }
                  <button
                    uiButton
                    variant="secondary"
                    size="sm"
                    [routerLink]="['/pedidos/detalle', o.orderId]"
                  >
                    Ver pedido
                  </button>
                  <button
                    type="button"
                    class="bpt-cancel-link"
                    [disabled]="cancelingId() === o.orderId"
                    (click)="cancelOrder(o)"
                  >
                    Anular
                  </button>
                </div>

                @if (expandedIds().has(o.orderId)) {
                  <div class="bpt-result-detail">
                    <div class="bpt-checks-row">
                      <div class="bpt-checks-row-title">Validaciones realizadas</div>
                      @for (c of o.checks; track c.group) {
                        <span class="bpt-check-pill" [class.fail]="!c.passed">
                          {{ c.passed ? '✓' : '✗' }} {{ c.groupName }}
                        </span>
                      }
                    </div>

                    @if (o.issues.length > 0) {
                      @for (group of groupedIssues(o); track group.group) {
                        <div class="bpt-issue-group">
                          <div class="bpt-issue-group-title">{{ group.groupName }}</div>
                          @for (issue of group.issues; track $index) {
                            <div class="bpt-issue-row">
                              • {{ issueText(issue) }}
                              @if (elsewhereLink(issue.code); as link) {
                                <a [routerLink]="link.route" class="bpt-issue-link">{{
                                  link.label
                                }}</a>
                              }
                            </div>
                          }
                        </div>
                      }
                    }

                    @if (hasRecalcFix(o)) {
                      <div class="bpt-row-actions">
                        <button
                          uiButton
                          variant="secondary"
                          size="sm"
                          [loading]="recalculatingId() === o.orderId"
                          (click)="recalculate(o)"
                        >
                          Recalcular pedido
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <div class="bpt-send-footer">
          <span
            >{{ validCount() }} pedido{{ validCount() === 1 ? '' : 's' }} válido{{
              validCount() === 1 ? '' : 's'
            }}</span
          >
          <span class="bpt-send-footer-net">Neto total {{ formatSoles(validNetTotal()) }}</span>
          <button
            uiButton
            variant="primary"
            [disabled]="validCount() === 0"
            (click)="confirmSend()"
          >
            Enviar {{ validCount() }} válidos
          </button>
        </div>
      }

      @if (phase() === 'sending') {
        <div class="bpt-progress-block">
          <div class="bpt-progress-head">
            <span>Enviando {{ sentSoFar() }} de {{ totalToSend() }} pedidos…</span>
          </div>
          <div class="bpt-progress-track">
            <div class="bpt-progress-fill" [style.width.%]="sendingPct()"></div>
          </div>
        </div>
      }

      @if (phase() === 'sent') {
        <div class="bpt-head">
          <h1>Resultado del envío</h1>
          <button uiButton variant="secondary" (click)="backToBrowse()">Volver al listado</button>
        </div>

        <div class="bpt-summary-row">
          <div class="bpt-summary-card">
            <span class="bpt-summary-value">{{ sendOutcomes().length }}</span>
            <span class="bpt-summary-label">Procesados</span>
          </div>
          <div class="bpt-summary-card">
            <span class="bpt-summary-value">{{ sentOkCount() }}</span>
            <span class="bpt-summary-label">Enviados</span>
          </div>
          <div class="bpt-summary-card bpt-summary-card-warn">
            <span class="bpt-summary-value">{{ notSentOutcomes().length }}</span>
            <span class="bpt-summary-label">No enviados</span>
          </div>
        </div>

        @if (notSentOutcomes().length === 0) {
          <ui-empty
            variant="al-dia"
            eyebrow="Al día"
            title="Se enviaron todos los pedidos"
            body="No quedó ningún pedido pendiente en esta tanda."
          />
        } @else {
          <div class="bpt-result-list">
            @for (o of notSentOutcomes(); track o.orderId) {
              <div class="bpt-result-row">
                <div class="bpt-not-sent-row">
                  <span class="bpt-cell-strong">{{ o.orderId }}</span>
                  <span class="bpt-result-customer">{{ o.customerName || '—' }}</span>
                  <span class="bpt-muted">{{
                    o.netAmount != null ? formatSoles(o.netAmount) : '—'
                  }}</span>
                  <span class="bpt-badge bpt-badge-warn">No enviado</span>
                  <span class="bpt-muted">{{ o.reason }}</span>
                </div>
                @if (o.issues.length > 0) {
                  <div class="bpt-result-detail">
                    @for (issue of o.issues; track $index) {
                      <div class="bpt-issue-row">• {{ issueText(issue) }}</div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .bpt-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
        padding-bottom: 100px;
      }
      .bpt-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .bpt-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .bpt-toolbar-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .bpt-info-banner {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-top: 20px;
        padding: 12px 16px;
        border: 1px solid var(--hairline);
        background: var(--faint);
        font-size: 13px;
        color: var(--ink-muted);
      }
      .bpt-info-banner .material-icons {
        flex: none;
        font-size: 18px;
        color: var(--ink-muted);
      }
      .bpt-stat-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 16px;
        margin-top: 16px;
      }
      .bpt-stat-card {
        border: 1px solid var(--hairline);
        padding: 16px 20px;
      }
      .bpt-stat-label {
        display: block;
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .bpt-stat-value {
        display: block;
        margin-top: 6px;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .bpt-stat-sub {
        display: block;
        margin-top: 2px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bpt-filters {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
        gap: 12px;
        margin: 20px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .bpt-skeleton {
        height: 200px;
        background: var(--faint);
        margin-top: 16px;
      }
      .bpt-table-desktop {
        width: 100%;
        margin-top: 16px;
      }
      .bpt-check-cell {
        width: 36px;
        text-align: center;
      }
      .bpt-cell-strong {
        font-weight: 800;
      }
      .bpt-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .bpt-origin-pill {
        display: inline-block;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 700;
        background: var(--faint);
        border: 1px solid var(--hairline);
      }
      .bpt-order-row {
        cursor: pointer;
      }
      .bpt-order-row:hover {
        background: var(--faint);
      }
      .bpt-chevron {
        color: var(--ink-muted);
        text-align: right;
        font-size: 18px;
      }
      .bpt-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
        flex-wrap: wrap;
      }
      .bpt-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .bpt-pager-total {
        margin-left: auto;
        font-size: 13px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .bpt-cards-mobile {
        display: none;
      }

      .bpt-progress-block {
        margin-top: 24px;
        display: grid;
        gap: 10px;
      }
      .bpt-progress-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        font-size: 14px;
        font-weight: 700;
        color: var(--ink);
      }
      .bpt-progress-track {
        height: 10px;
        background: var(--faint);
      }
      .bpt-progress-fill {
        height: 100%;
        background: var(--accent);
        transition: width var(--dur-base) var(--ease-standard);
      }

      .bpt-notice {
        margin: 12px 0 0;
        padding: 10px 14px;
        border-left: 3px solid var(--st-pendiente);
        background: color-mix(in srgb, var(--st-pendiente) 10%, transparent);
        font-size: 13px;
      }
      .bpt-ok-banner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-top: 20px;
        padding: 14px 18px;
        border: 1px solid var(--success);
        background: color-mix(in srgb, var(--success) 10%, transparent);
        color: var(--ink);
        font-size: 13px;
      }
      .bpt-ok-banner .material-icons {
        flex: none;
        font-size: 22px;
        color: var(--success);
      }
      .bpt-warn-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 20px;
        padding: 14px 18px;
        border: 1px solid var(--accent);
        background: color-mix(in srgb, var(--accent) 8%, transparent);
        color: var(--ink);
        font-size: 13px;
      }
      .bpt-warn-banner .material-icons {
        flex: none;
        font-size: 22px;
        color: var(--accent-ink);
      }
      .bpt-warn-banner-text {
        flex: 1;
      }
      .bpt-summary-row {
        display: flex;
        align-items: stretch;
        gap: 16px;
        margin-top: 20px;
        flex-wrap: wrap;
      }
      .bpt-summary-card {
        border: 1px solid var(--hairline);
        padding: 14px 20px;
        min-width: 110px;
      }
      .bpt-summary-card-warn {
        border-color: var(--st-pendiente);
      }
      .bpt-summary-value {
        display: block;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .bpt-summary-card-warn .bpt-summary-value {
        color: var(--st-pendiente);
      }
      .bpt-summary-label {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bpt-show-filter {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 20px 0 16px;
      }
      .bpt-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        padding: 7px 14px;
        border: 2px solid var(--divider);
        border-radius: var(--radius-pill);
        background: var(--surface);
        color: var(--ink-muted);
        cursor: pointer;
      }
      .bpt-chip.on {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--bg);
      }
      .bpt-chip-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, currentColor 16%, transparent);
        font-size: 11px;
      }

      .bpt-result-list {
        border: 1px solid var(--hairline);
        display: grid;
        gap: 1px;
        background: var(--hairline);
      }
      .bpt-result-row {
        background: var(--bg);
      }
      .bpt-result-summary {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 16px;
        flex-wrap: wrap;
      }
      .bpt-expand-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 0;
        background: transparent;
        font-family: var(--font-sans);
        cursor: pointer;
        padding: 0;
      }
      .bpt-expand-arrow {
        color: var(--ink-muted);
        width: 14px;
        flex: none;
      }
      .bpt-result-customer {
        flex: 1;
        color: var(--ink);
        min-width: 160px;
      }
      .bpt-checks-sub {
        margin-top: 2px;
        font-size: 12px;
        color: var(--success);
      }
      .bpt-checks-sub.fail {
        color: var(--st-vencida, #d13b3b);
      }
      .bpt-result-zone {
        flex: none;
      }
      .bpt-badge {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 800;
        padding: 4px 10px;
        border-radius: var(--radius-pill);
        white-space: nowrap;
      }
      .bpt-badge-ok {
        color: var(--success);
        background: color-mix(in srgb, var(--success) 14%, transparent);
      }
      .bpt-badge-warn {
        color: var(--st-vencida, #d13b3b);
        background: color-mix(in srgb, var(--st-vencida, #d13b3b) 12%, transparent);
      }
      .bpt-cancel-link {
        flex: none;
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        color: var(--st-vencida, #d13b3b);
        font-weight: 700;
        font-size: 13px;
        padding: 6px 4px;
      }
      .bpt-cancel-link:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .bpt-result-detail {
        padding: 0 16px 16px 44px;
        display: grid;
        gap: 12px;
      }
      .bpt-checks-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }
      .bpt-checks-row-title {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
        width: 100%;
      }
      .bpt-check-pill {
        display: inline-block;
        padding: 4px 10px;
        border-radius: var(--radius-pill);
        color: var(--success);
        background: color-mix(in srgb, var(--success) 12%, transparent);
      }
      .bpt-check-pill.fail {
        color: var(--st-vencida, #d13b3b);
        background: color-mix(in srgb, var(--st-vencida, #d13b3b) 12%, transparent);
        font-weight: 700;
      }
      .bpt-issue-group {
        font-size: 13px;
      }
      .bpt-issue-group-title {
        font-weight: 800;
        color: var(--ink);
        margin-bottom: 2px;
      }
      .bpt-issue-row {
        color: var(--ink-muted);
        padding: 2px 0;
      }
      .bpt-issue-link {
        margin-left: 6px;
        color: var(--accent-ink);
        font-weight: 700;
        text-decoration: none;
      }
      .bpt-issue-link:hover {
        text-decoration: underline;
      }
      .bpt-row-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .bpt-not-sent-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 16px;
        flex-wrap: wrap;
      }
      .bpt-send-footer {
        position: sticky;
        bottom: 0;
        display: flex;
        align-items: center;
        gap: 20px;
        margin-top: 24px;
        padding: 16px 20px;
        border: 1px solid var(--hairline);
        background: var(--surface);
        font-size: 14px;
        font-weight: 700;
        color: var(--ink);
      }
      .bpt-send-footer-net {
        margin-left: auto;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      @media (max-width: 767px) {
        .bpt-page {
          padding: var(--sp-4);
          padding-bottom: 100px;
        }
        .bpt-table-desktop {
          display: none;
        }
        .bpt-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .bpt-card-mobile {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
        }
        .bpt-card-mobile-head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }
        .bpt-card-mobile-name {
          font-weight: 800;
          font-size: 14px;
        }
        .bpt-result-summary {
          flex-wrap: wrap;
        }
        .bpt-send-footer {
          flex-wrap: wrap;
          gap: 8px;
        }
        .bpt-send-footer-net {
          margin-left: 0;
        }
      }
    `,
  ],
})
export class BillingPendingTab {
  private orderSvc = inject(OrderAdminService);
  private billingSvc = inject(BillingValidationAdminService);
  private lookupSvc = inject(LookupService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected formatSoles = formatSoles;
  protected dateTimeText = dateTimeText;
  protected timeText = timeText;
  protected originName = originName;
  protected hasRecalcFix = (o: OrderBillingValidation) =>
    issuesHaveRecalcFix(o.issues.map((i) => i.code));
  protected elsewhereLink = elsewhereLinkFor;

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

  protected phase = signal<Phase>('browse');

  // — Fase "browse" —
  protected dayFilter = signal(todayIso());
  protected vendorFilter = signal<UiLookupItem | null>(null);
  protected searchQuery = signal('');
  protected rows = signal<AdminOrderSummary[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected loading = signal(true);
  protected error = signal(false);
  /** Guarda la fila completa (no solo el id) para poder sumar el neto seleccionado entre páginas. */
  protected selectedOrders = signal<Map<number, AdminOrderSummary>>(new Map());
  protected selectedIds = computed(() => new Set(this.selectedOrders().keys()));
  protected selectedCount = computed(() => this.selectedOrders().size);
  protected selectedNetTotal = computed(() =>
    Array.from(this.selectedOrders().values()).reduce((sum, o) => sum + o.netAmount, 0),
  );

  protected filteredRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(
      (o) => o.customerName.toLowerCase().includes(q) || String(o.orderId).includes(q),
    );
  });

  protected pageNetTotal = computed(() =>
    this.filteredRows().reduce((sum, o) => sum + o.netAmount, 0),
  );

  protected allPageSelected = computed(
    () =>
      this.filteredRows().length > 0 &&
      this.filteredRows().every((o) => this.selectedIds().has(o.orderId)),
  );

  private filtersEffect = effect(() => {
    this.dayFilter();
    this.vendorFilter();
    untracked(() => {
      this.page.set(0);
      this.load();
    });
  });

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 pedido' : `${n} pedidos`;
  }

  protected dayLongText(): string {
    const [y, m, d] = this.dayFilter().split('-').map(Number);
    return format(new Date(y, m - 1, d), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.orderSvc
      .list({
        from: this.dayFilter(),
        to: this.dayFilter(),
        statusCode: 'OPEN',
        salespersonId: this.vendorFilter()?.id,
        page: this.page(),
        size: 20,
      })
      .subscribe({
        next: (result) => {
          this.rows.set(result.content ?? []);
          this.totalElements.set(result.totalElements ?? 0);
          this.totalPages.set(result.totalPages ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.load();
  }
  protected nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  protected toggleSelect(o: AdminOrderSummary) {
    const next = new Map(this.selectedOrders());
    if (next.has(o.orderId)) next.delete(o.orderId);
    else next.set(o.orderId, o);
    this.selectedOrders.set(next);
  }

  protected toggleSelectPage(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    const next = new Map(this.selectedOrders());
    for (const o of this.filteredRows()) {
      if (checked) next.set(o.orderId, o);
      else next.delete(o.orderId);
    }
    this.selectedOrders.set(next);
  }

  // — Validación por tandas (sección 6.4/6.5) —
  protected validationDate = signal<string | null>(null);
  protected validationOrders = signal<OrderBillingValidation[]>([]);
  protected notFoundCount = signal(0);
  protected totalToValidate = signal(0);
  protected validatedSoFar = signal(0);
  protected validCount = signal(0);
  protected invalidCount = signal(0);
  protected validatedTotal = computed(() => this.validCount() + this.invalidCount());
  protected validatingPct = computed(() =>
    this.totalToValidate() > 0
      ? Math.round((this.validatedSoFar() / this.totalToValidate()) * 100)
      : 0,
  );
  private cancelRequested = signal(false);

  protected showFilter = signal<ShowFilter>('issues');
  protected expandedIds = signal<Set<number>>(new Set());
  protected recalculatingId = signal<number | null>(null);
  protected cancelingId = signal<number | null>(null);
  protected recalculatingAll = signal(false);
  protected recalculateAllProgress = signal({ done: 0, total: 0 });
  protected recalculateAllPct = computed(() => {
    const p = this.recalculateAllProgress();
    return p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
  });

  protected eligibleForRecalc = computed(() =>
    this.validationOrders().filter((o) => !o.valid && this.hasRecalcFix(o)),
  );
  protected validNetTotal = computed(() =>
    this.validationOrders()
      .filter((o) => o.valid)
      .reduce((sum, o) => sum + o.netAmount, 0),
  );

  protected filteredValidationOrders = computed(() => {
    const filter = this.showFilter();
    const orders = this.validationOrders();
    if (filter === 'valid') return orders.filter((o) => o.valid);
    if (filter === 'issues') return orders.filter((o) => !o.valid);
    return orders;
  });

  protected passedChecksCount(o: OrderBillingValidation): number {
    return o.checks.filter((c) => c.passed).length;
  }

  private resetValidationState() {
    this.validationOrders.set([]);
    this.notFoundCount.set(0);
    this.totalToValidate.set(0);
    this.validatedSoFar.set(0);
    this.validCount.set(0);
    this.invalidCount.set(0);
    this.cancelRequested.set(false);
    this.expandedIds.set(new Set());
    this.showFilter.set('issues');
  }

  private accumulate(result: {
    validCount: number;
    invalidCount: number;
    notFoundOrderIds: number[];
    orders: OrderBillingValidation[];
  }) {
    this.validCount.update((n) => n + result.validCount);
    this.invalidCount.update((n) => n + result.invalidCount);
    this.notFoundCount.update((n) => n + result.notFoundOrderIds.length);
    this.validatedSoFar.update((n) => n + result.orders.length);
    this.validationOrders.update((list) =>
      [...list, ...result.orders].sort((a, b) => a.orderId - b.orderId),
    );
  }

  protected validateAllDay() {
    this.resetValidationState();
    this.validationDate.set(this.dayFilter());
    this.phase.set('validating');
    this.runValidatePage(0);
  }

  private runValidatePage(page: number) {
    if (this.cancelRequested()) {
      this.phase.set('results');
      return;
    }
    this.billingSvc.validate({ date: this.dayFilter(), page, size: VALIDATE_CHUNK }).subscribe({
      next: (result) => {
        this.totalToValidate.set(result.totalElements);
        this.accumulate(result);
        if (page + 1 < result.totalPages && !this.cancelRequested()) {
          this.runValidatePage(page + 1);
        } else {
          this.phase.set('results');
        }
      },
      error: () => this.phase.set('results'),
    });
  }

  protected validateSelected() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.resetValidationState();
    this.validationDate.set(null);
    this.totalToValidate.set(ids.length);
    this.phase.set('validating');
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += VALIDATE_CHUNK)
      chunks.push(ids.slice(i, i + VALIDATE_CHUNK));
    this.runValidateChunks(chunks, 0);
  }

  private runValidateChunks(chunks: number[][], index: number) {
    if (index >= chunks.length || this.cancelRequested()) {
      this.phase.set('results');
      if (this.notFoundCount() > 0) {
        this.toast.info(
          `${this.notFoundCount()} pedido${this.notFoundCount() === 1 ? '' : 's'} ya no ${this.notFoundCount() === 1 ? 'está disponible' : 'están disponibles'}.`,
        );
      }
      return;
    }
    this.billingSvc.validate({ orderIds: chunks[index] }).subscribe({
      next: (result) => {
        this.accumulate(result);
        this.runValidateChunks(chunks, index + 1);
      },
      error: () => this.phase.set('results'),
    });
  }

  protected cancelValidation() {
    this.cancelRequested.set(true);
  }

  protected backToBrowse() {
    this.phase.set('browse');
    this.selectedOrders.set(new Map());
    this.load();
  }

  protected toggleExpand(orderId: number) {
    const next = new Set(this.expandedIds());
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    this.expandedIds.set(next);
  }

  protected groupedIssues(
    o: OrderBillingValidation,
  ): { group: string; groupName: string; issues: BillingIssue[] }[] {
    const byGroup = new Map<string, { groupName: string; issues: BillingIssue[] }>();
    for (const issue of o.issues) {
      const groupName = o.checks.find((c) => c.group === issue.group)?.groupName ?? issue.group;
      if (!byGroup.has(issue.group)) byGroup.set(issue.group, { groupName, issues: [] });
      byGroup.get(issue.group)!.issues.push(issue);
    }
    return Array.from(byGroup, ([group, v]) => ({ group, ...v }));
  }

  protected issueText(issue: BillingIssue): string {
    return issue.lineNumber != null
      ? `Línea ${issue.lineNumber} · ${issue.message}`
      : issue.message;
  }

  private replaceValidationOrder(updated: OrderBillingValidation) {
    const previous = this.validationOrders().find((o) => o.orderId === updated.orderId);
    if (previous) {
      this.validCount.update((n) => n + (updated.valid ? 1 : 0) - (previous.valid ? 1 : 0));
      this.invalidCount.update((n) => n + (updated.valid ? 0 : 1) - (previous.valid ? 0 : 1));
    }
    this.validationOrders.update((list) =>
      list.map((o) => (o.orderId === updated.orderId ? updated : o)),
    );
  }

  private removeValidationOrder(orderId: number) {
    const previous = this.validationOrders().find((o) => o.orderId === orderId);
    if (previous) {
      if (previous.valid) this.validCount.update((n) => Math.max(0, n - 1));
      else this.invalidCount.update((n) => Math.max(0, n - 1));
      this.validatedSoFar.update((n) => Math.max(0, n - 1));
    }
    this.validationOrders.update((list) => list.filter((o) => o.orderId !== orderId));
  }

  /** Recalcula un pedido: precios/promociones frescos y vuelve a validar solo ese. */
  private recalculateOne(o: OrderBillingValidation, onDone: () => void) {
    this.orderSvc.detail(o.orderId).subscribe({
      next: (detail) => {
        const catalogItems = detail.items
          .filter((i) => !i.bonus)
          .map((i) => ({ productId: i.productId, newQuantity: i.quantity }));
        this.orderSvc.updateItems(o.orderId, { catalogItems, predictedItems: [] }).subscribe({
          next: () => {
            this.billingSvc.validate({ orderIds: [o.orderId] }).subscribe({
              next: (result) => {
                const updated = result.orders[0];
                if (updated) this.replaceValidationOrder(updated);
                onDone();
              },
              error: () => onDone(),
            });
          },
          error: () => onDone(),
        });
      },
      error: () => onDone(),
    });
  }

  protected recalculate(o: OrderBillingValidation) {
    this.dialog
      .confirm({
        title: 'Recalcular pedido',
        message: `Se actualizarán los precios y las promociones del pedido ${o.orderId}. Su total puede cambiar. ¿Recalcular?`,
        confirmLabel: 'Recalcular',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.recalculatingId.set(o.orderId);
        this.recalculateOne(o, () => {
          this.recalculatingId.set(null);
          this.toast.success(`Pedido ${o.orderId} recalculado.`);
        });
      });
  }

  /** Recalcular pendientes (sección pedida aparte): todos los que tienen un motivo que se corrige recalculando, en una sola tanda. */
  protected recalculateAllPending() {
    const targets = this.eligibleForRecalc();
    if (targets.length === 0) return;
    this.dialog
      .confirm({
        title: 'Recalcular pedidos con motivo',
        message: `Se recalcularán ${targets.length} pedido${targets.length === 1 ? '' : 's'}: los precios y las promociones se actualizan y el total puede cambiar. ¿Recalcular?`,
        confirmLabel: 'Recalcular',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.recalculatingAll.set(true);
        this.recalculateAllProgress.set({ done: 0, total: targets.length });
        this.runRecalculateAll(targets, 0);
      });
  }

  private runRecalculateAll(targets: OrderBillingValidation[], index: number) {
    if (index >= targets.length) {
      this.recalculatingAll.set(false);
      this.toast.success(
        `${targets.length} pedido${targets.length === 1 ? '' : 's'} recalculado${targets.length === 1 ? '' : 's'}.`,
      );
      return;
    }
    this.recalculateOne(targets[index], () => {
      this.recalculateAllProgress.update((p) => ({ ...p, done: p.done + 1 }));
      this.runRecalculateAll(targets, index + 1);
    });
  }

  protected cancelOrder(o: OrderBillingValidation) {
    this.dialog
      .confirm({
        title: 'Anular pedido',
        message: `¿Anular el pedido ${o.orderId} de ${o.customerName}? Se devolverá el stock y se revertirán las promociones.`,
        confirmLabel: 'Anular',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.cancelingId.set(o.orderId);
        this.orderSvc.cancel(o.orderId).subscribe({
          next: () => {
            this.cancelingId.set(null);
            this.removeValidationOrder(o.orderId);
            this.toast.success(`Pedido ${o.orderId} anulado.`);
          },
          error: (err) => {
            this.cancelingId.set(null);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.toast.error(detalle || 'No pudimos anular el pedido.');
          },
        });
      });
  }

  // — Envío por tandas (sección 8.5) —
  protected totalToSend = signal(0);
  protected sentSoFar = signal(0);
  protected sendOutcomes = signal<OrderBillingSendOutcome[]>([]);
  protected sentOkCount = computed(() => this.sendOutcomes().filter((o) => o.sent).length);
  protected notSentOutcomes = computed(() => this.sendOutcomes().filter((o) => !o.sent));
  protected sendingPct = computed(() =>
    this.totalToSend() > 0 ? Math.round((this.sentSoFar() / this.totalToSend()) * 100) : 0,
  );

  protected confirmSend() {
    const validIds = this.validationOrders()
      .filter((o) => o.valid)
      .map((o) => o.orderId);
    if (validIds.length === 0) return;
    this.dialog
      .confirm({
        title: 'Enviar a facturación',
        message: `Se enviarán ${validIds.length} pedidos a facturación. Después no se podrán editar ni anular. ¿Enviar?`,
        confirmLabel: 'Enviar',
      })
      .subscribe((confirmed) => {
        if (confirmed) this.startSend(validIds);
      });
  }

  private startSend(orderIds: number[]) {
    this.sendOutcomes.set([]);
    this.totalToSend.set(orderIds.length);
    this.sentSoFar.set(0);
    this.phase.set('sending');
    const chunks: number[][] = [];
    for (let i = 0; i < orderIds.length; i += SEND_CHUNK)
      chunks.push(orderIds.slice(i, i + SEND_CHUNK));
    this.runSendChunks(chunks, 0);
  }

  private runSendChunks(chunks: number[][], index: number) {
    if (index >= chunks.length) {
      this.phase.set('sent');
      return;
    }
    this.billingSvc.send({ orderIds: chunks[index] }).subscribe({
      next: (result) => {
        this.sentSoFar.update((n) => n + result.orders.length);
        this.sendOutcomes.update((list) => [...list, ...result.orders]);
        this.runSendChunks(chunks, index + 1);
      },
      error: () => this.phase.set('sent'),
    });
  }
}
