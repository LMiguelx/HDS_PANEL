import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  AvailableDriverView,
  AvailableHelperView,
  CreateTeamCommand,
  CreateVehicleCommand,
  TeamView,
  VehicleView,
} from '../../shared/models/fleet.models';

@Injectable({ providedIn: 'root' })
export class FleetAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/fleet`;

  createVehicle(cmd: CreateVehicleCommand) {
    return this.http.post<VehicleView>(`${this.base}/vehicles`, cmd);
  }

  deactivateVehicle(vehicleId: number) {
    return this.http.post<void>(`${this.base}/vehicles/${vehicleId}/deactivate`, {});
  }

  vehicles() {
    return this.http.get<VehicleView[]>(`${this.base}/vehicles`);
  }

  createTeam(cmd: CreateTeamCommand) {
    return this.http.post<TeamView>(`${this.base}/teams`, cmd);
  }

  /** `lastDay` opcional — si no se manda, hoy. */
  endTeam(teamId: number, lastDay?: string) {
    let params = new HttpParams();
    if (lastDay) params = params.set('lastDay', lastDay);
    return this.http.post<void>(`${this.base}/teams/${teamId}/end`, {}, { params });
  }

  teams() {
    return this.http.get<TeamView[]>(`${this.base}/teams`);
  }

  availableDrivers() {
    return this.http.get<AvailableDriverView[]>(`${this.base}/available-drivers`);
  }

  /** Vive bajo /api/deliveries, no /api/fleet, según el documento. */
  availableHelpers() {
    return this.http.get<AvailableHelperView[]>(
      `${environment.apiUrl}/deliveries/available-helpers`,
    );
  }
}
