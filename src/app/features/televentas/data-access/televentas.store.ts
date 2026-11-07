import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CustomerService } from '../../customers/customer';
import { CustomerSummary } from '../../../shared/models/customer.models';
import { AssignmentView } from '../../../shared/models/assignment-admin.models';
import { TelesalesApi } from './televentas.api';
import { DailyOrderSummaryView, TodayStopView } from '../domain/televentas.models';

/**
 * Estado de Mi día (doc 42, sección 6): plan + cartera + cobertura + venta
 * del día, cargados juntos al abrir la pantalla y con "Actualizar" — nunca
 * refresco automático (sección 2.3). `ensureLoaded()` también lo usa Nuevo
 * pedido cuando se entra directo (sin pasar por Mi día): necesita la misma
 * cartera ya cargada para su buscador (sección 7.2), sin pedirla de nuevo.
 */
@Injectable({ providedIn: 'root' })
export class TelesalesDayStore {
  private api = inject(TelesalesApi);
  private customerSvc = inject(CustomerService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly plan = signal<TodayStopView[]>([]);
  readonly portfolio = signal<CustomerSummary[]>([]);
  readonly coverage = signal<CustomerSummary[]>([]);
  readonly dailySummary = signal<DailyOrderSummaryView | null>(null);
  readonly updatedAt = signal<Date | null>(null);

  readonly fullAssignments = signal<AssignmentView[]>([]);
  readonly fullAssignmentsLoading = signal(false);
  private fullAssignmentsLoaded = false;

  /**
   * Clientes con una llamada registrada en ESTA sesión (pedido o llamada sin
   * compra) — sección 6.4: el ícono de teléfono de la lista solo lo sabe el
   * panel por lo que él mismo registró; para el resto basta el estado.
   */
  readonly calledThisSession = signal<ReadonlySet<number>>(new Set());

  markCalled(customerId: number) {
    this.calledThisSession.update((set) => new Set(set).add(customerId));
  }

  private loaded = false;

  /** Primera carga perezosa: la hace quien primero entre a Mi día o a Nuevo pedido. */
  ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    this.refresh();
  }

  refresh() {
    this.loading.set(true);
    this.error.set(false);
    forkJoin({
      plan: this.api.todayPlan(),
      portfolio: this.customerSvc.portfolio(),
      coverage: this.customerSvc.portfolioCoverage().pipe(catchError(() => of([]))),
      summary: this.api.myDailySummary().pipe(catchError(() => of(null))),
    }).subscribe({
      next: (r) => {
        this.plan.set(r.plan);
        this.portfolio.set(r.portfolio);
        this.coverage.set(r.coverage);
        this.dailySummary.set(r.summary);
        this.updatedAt.set(new Date());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  /**
   * Doc 42, sección 6.6: tras un pedido o una llamada, solo se vuelve a
   * pedir la cartera (para el estado del cliente) y la liquidación (para la
   * fila de indicadores) — el plan no cambia en el día.
   */
  refreshAfterAction() {
    this.customerSvc.portfolio().subscribe((list) => this.portfolio.set(list));
    this.customerSvc.portfolioCoverage().subscribe((list) => this.coverage.set(list));
    this.api.myDailySummary().subscribe({
      next: (s) => this.dailySummary.set(s),
      error: () => undefined,
    });
  }

  /** Cartera completa (sección 6.3): se pide una sola vez, al abrir esa pestaña. */
  ensureFullAssignmentsLoaded() {
    if (this.fullAssignmentsLoaded) return;
    this.fullAssignmentsLoaded = true;
    this.fullAssignmentsLoading.set(true);
    this.api.myAssignments().subscribe({
      next: (list) => {
        this.fullAssignments.set(list);
        this.fullAssignmentsLoading.set(false);
      },
      error: () => {
        this.fullAssignmentsLoading.set(false);
      },
    });
  }
}
