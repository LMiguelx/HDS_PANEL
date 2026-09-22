import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DashboardTodayView } from '../../shared/models/dashboard.models';

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
}
