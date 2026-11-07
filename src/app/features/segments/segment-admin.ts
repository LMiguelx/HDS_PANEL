import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  CreateSegmentCommand,
  ImportMembersResult,
  ImportMode,
  MemberView,
  SegmentView,
} from './segment.models';

/** CustomerSegmentController, /api/segments. `segment.manage`. */
@Injectable({ providedIn: 'root' })
export class SegmentAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/segments`;

  list(includeArchived = false) {
    const params = new HttpParams().set('includeArchived', String(includeArchived));
    return this.http.get<SegmentView[]>(this.base, { params });
  }

  create(cmd: CreateSegmentCommand) {
    return this.http.post<SegmentView>(this.base, cmd);
  }

  archive(segmentId: number) {
    return this.http.post<void>(`${this.base}/${segmentId}/archive`, {});
  }

  activate(segmentId: number) {
    return this.http.post<void>(`${this.base}/${segmentId}/activate`, {});
  }

  members(segmentId: number, q: string, page = 0, size = 50) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q) params = params.set('q', q);
    return this.http.get<PageResponse<MemberView>>(`${this.base}/${segmentId}/members`, {
      params,
    });
  }

  addMember(segmentId: number, customerId: number) {
    return this.http.post<void>(`${this.base}/${segmentId}/members/${customerId}`, {});
  }

  removeMember(segmentId: number, customerId: number) {
    return this.http.delete<void>(`${this.base}/${segmentId}/members/${customerId}`);
  }

  /** dryRun=true (default) solo simula; dryRun=false aplica los cambios. */
  importMembers(segmentId: number, file: File, mode: ImportMode, dryRun: boolean) {
    const form = new FormData();
    form.append('file', file, file.name);
    const params = new HttpParams().set('mode', mode).set('dryRun', String(dryRun));
    return this.http.post<ImportMembersResult>(`${this.base}/${segmentId}/members/import`, form, {
      params,
    });
  }
}
