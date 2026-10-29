import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DashboardTodayView, TopSalespersonView } from '../../shared/models/dashboard.models';

/** DashboardController, /api/admin/dashboard. `report.view`. */
@Injectable({ providedIn: 'root' })
export class DashboardAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/dashboard`;

  today(date?: string) {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<DashboardTodayView>(`${this.base}/today`, { params });
  }

  /**
   * Se llama solo al cambiar el selector de cantidad o canal del bloque
   * "Mejores ventas del día" — nunca recarga /today completo.
   */
  topSalespeople(date?: string, limit?: number, salesChannelId?: number) {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    if (limit) params = params.set('limit', limit);
    if (salesChannelId != null) params = params.set('salesChannelId', salesChannelId);
    return this.http.get<TopSalespersonView[]>(`${this.base}/top-salespeople`, { params });
  }
}
