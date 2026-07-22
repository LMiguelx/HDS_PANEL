import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CreateTeamCommand,
  CreateVehicleCommand,
  TeamView,
  VehicleView,
} from '../../shared/models/fleet.models';

@Injectable({ providedIn: 'root' })
export class FleetService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/fleet`;

  // Vehículos
  vehicles() {
    return this.http.get<VehicleView[]>(`${this.base}/vehicles`);
  }
  createVehicle(cmd: CreateVehicleCommand) {
    return this.http.post<VehicleView>(`${this.base}/vehicles`, cmd);
  }
  deactivateVehicle(id: number) {
    return this.http.post<void>(`${this.base}/vehicles/${id}/deactivate`, {});
  }

  // Equipos
  teams() {
    return this.http.get<TeamView[]>(`${this.base}/teams`);
  }
  createTeam(cmd: CreateTeamCommand) {
    return this.http.post<TeamView>(`${this.base}/teams`, cmd);
  }
  endTeam(id: number, lastDay: string) {
    return this.http.post<void>(
      `${this.base}/teams/${id}/end`,
      {},
      {
        params: new HttpParams().set('lastDay', lastDay),
      },
    );
  }
}
