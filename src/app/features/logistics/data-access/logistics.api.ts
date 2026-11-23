import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { LogisticsDashboardView } from '../domain/logistics.models';

/** doc 93, sección 2.2: una sola llamada, independiente del gráfico de marcas. */
@Injectable({ providedIn: 'root' })
export class LogisticsApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/logistics`;

  /** `date` sin enviar = hoy; el Inicio siempre pide hoy, sin selector de fecha. */
  dashboard(date?: string) {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<LogisticsDashboardView>(`${this.base}/dashboard`, { params });
  }
}
