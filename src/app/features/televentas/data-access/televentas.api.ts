import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { PageResponse } from '../../../shared/models/api.models';
import { AssignmentView } from '../../../shared/models/assignment-admin.models';
import { OrderSummary } from '../../../shared/models/order.models';
import {
  MobilePromoProgressView,
  MobilePromoView,
} from '../../../shared/models/promo-simulation.models';
import { OrderCreatedResult, SuggestedItem } from '../../../shared/models/counter-order.models';
import {
  CreateOrderCommand,
  DailyOrderSummaryView,
  DraftProgressCommand,
  PriceResolved,
  RegisterVisitCommand,
  TodayStopView,
  VisitReasonView,
  VisitView,
} from '../domain/televentas.models';

function params(obj: Record<string, string | number | undefined>): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== '') p = p.set(key, String(value));
  }
  return p;
}

/**
 * Endpoints propios del modo televentas (doc 42) que ningún otro feature ya
 * consume. Jornada (`RouteStore`/`RouteAdminService`), catálogo/condiciones
 * de pago (`CatalogLookupService`), productos (`ProductAdminService`),
 * cartera (`CustomerService`), almacenes y su stock (`InventoryAdminService`)
 * y el detalle/edición/anulación de un pedido (`OrderAdminService`) se
 * reutilizan tal cual desde sus features — mismo criterio ya tolerado para
 * utilidades transversales (ARCHITECTURE_PANEL, sección 4).
 */
@Injectable({ providedIn: 'root' })
export class TelesalesApi {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  /** GET /api/assignments/me/today-plan — seller.view. */
  todayPlan(date?: string) {
    return this.http.get<TodayStopView[]>(`${this.api}/assignments/me/today-plan`, {
      params: params({ date }),
    });
  }

  /** GET /api/assignments/me — cartera completa con horario (seller.view). */
  myAssignments(date?: string) {
    return this.http.get<AssignmentView[]>(`${this.api}/assignments/me`, {
      params: params({ date }),
    });
  }

  /** GET /api/routes/visit-reasons?visitStatusId=3 — motivos de "No compró". */
  visitReasons(visitStatusId: number) {
    return this.http.get<VisitReasonView[]>(`${this.api}/routes/visit-reasons`, {
      params: params({ visitStatusId }),
    });
  }

  /** POST /api/routes/visits — visit.register. */
  registerVisit(cmd: RegisterVisitCommand) {
    return this.http.post<VisitView>(`${this.api}/routes/visits`, cmd);
  }

  /** GET /api/orders/my — order.create, del más reciente al más antiguo. */
  myOrders(page = 0, size = 20) {
    return this.http.get<PageResponse<OrderSummary>>(`${this.api}/orders/my`, {
      params: params({ page, size }),
    });
  }

  /** GET /api/orders/my/daily-summary — order.create; date opcional (hoy por defecto). */
  myDailySummary(date?: string) {
    return this.http.get<DailyOrderSummaryView>(`${this.api}/orders/my/daily-summary`, {
      params: params({ date }),
    });
  }

  /** POST /api/orders — order.create. El panel siempre envía remote: true. */
  createOrder(cmd: CreateOrderCommand) {
    return this.http.post<OrderCreatedResult>(`${this.api}/orders`, cmd);
  }

  /** GET /api/orders/suggested/{customerId} — order.create. */
  suggested(customerId: number, limit = 15) {
    return this.http.get<SuggestedItem[]>(`${this.api}/orders/suggested/${customerId}`, {
      params: params({ limit }),
    });
  }

  /** GET /api/mobile/promos/available — mismo contrato del doc 30, sección 7.7. */
  availablePromos(customerId: number) {
    return this.http.get<MobilePromoView[]>(`${this.api}/mobile/promos/available`, {
      params: params({ customerId }),
    });
  }

  /** POST /api/mobile/promos/draft-preview — solo el progreso, con debounce en quien llama. */
  draftPreview(cmd: DraftProgressCommand) {
    return this.http.post<MobilePromoProgressView[]>(
      `${this.api}/mobile/promos/draft-preview`,
      cmd,
    );
  }

  /** GET /api/prices/resolve — price.view. */
  resolvePrice(
    productId: number,
    paymentConditionId: number,
    customerTypeId: number,
    quantity: number,
  ) {
    return this.http.get<PriceResolved>(`${this.api}/prices/resolve`, {
      params: params({ productId, paymentConditionId, customerTypeId, quantity }),
    });
  }
}
