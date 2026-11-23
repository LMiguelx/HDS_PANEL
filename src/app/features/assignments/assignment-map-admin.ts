import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  MapCustomerPopupView,
  MapGlobalResponse,
  MapOverviewResponse,
  MapPortfolioResponse,
  MapVendorDayResponse,
  MapVendorTrackResponse,
} from '../../shared/models/assignment-map.models';

/**
 * Mapa de asignaciones — doc 40. Reemplaza `AssignmentAdminService.map()`
 * (`GET /api/admin/assignments/map`, obsoleto) y a `GET /api/routes/today/plan`,
 * que el mapa deja de usar. Rutas relativas a `/api/admin/assignments/map`.
 */
@Injectable({ providedIn: 'root' })
export class AssignmentMapAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/assignments/map`;

  private dateParams(date?: string): HttpParams {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return params;
  }

  overview(date?: string) {
    return this.http.get<MapOverviewResponse>(`${this.base}/overview`, {
      params: this.dateParams(date),
    });
  }

  vendorDay(userId: number, date?: string) {
    return this.http.get<MapVendorDayResponse>(`${this.base}/vendors/${userId}/day`, {
      params: this.dateParams(date),
    });
  }

  vendorTrack(userId: number, date: string | undefined, afterVisitId: number | null) {
    let params = this.dateParams(date);
    if (afterVisitId != null) params = params.set('afterVisitId', String(afterVisitId));
    return this.http.get<MapVendorTrackResponse>(`${this.base}/vendors/${userId}/track`, {
      params,
    });
  }

  vendorPortfolio(userId: number, date?: string) {
    return this.http.get<MapPortfolioResponse>(`${this.base}/vendors/${userId}/portfolio`, {
      params: this.dateParams(date),
    });
  }

  global(date?: string) {
    return this.http.get<MapGlobalResponse>(`${this.base}/global`, {
      params: this.dateParams(date),
    });
  }

  customerPopup(customerId: number, date?: string) {
    return this.http.get<MapCustomerPopupView>(`${this.base}/customers/${customerId}`, {
      params: this.dateParams(date),
    });
  }
}
