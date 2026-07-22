import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TenantService } from './tenant';
import { TenantInfo } from '../../shared/models/tenant.models';

@Component({
  selector: 'app-tenant-info',
  imports: [MatCardModule, MatProgressBarModule],
  template: `
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    } @else if (tenant(); as t) {
      <mat-card class="card">
        <div class="grid">
          <div>
            <span class="muted">Razón social</span><br /><strong>{{ t.legalName }}</strong>
          </div>
          <div><span class="muted">Nombre comercial</span><br />{{ t.tradeName }}</div>
          <div><span class="muted">RUC</span><br />{{ t.taxId }}</div>
          <div><span class="muted">Plan</span><br />{{ t.planCode }}</div>
          <div><span class="muted">Estado</span><br />{{ t.status }}</div>
          <div><span class="muted">Email</span><br />{{ t.contactEmail }}</div>
          <div><span class="muted">Teléfono</span><br />{{ t.contactPhone }}</div>
        </div>
      </mat-card>
    } @else {
      <p class="muted">No se pudo cargar la información de la empresa.</p>
    }
  `,
  styles: [
    `
      .card {
        padding: 20px;
        max-width: 720px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px 24px;
      }
      @media (max-width: 560px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TenantInfoPage {
  private tenantSvc = inject(TenantService);
  readonly loading = signal(true);
  readonly tenant = signal<TenantInfo | null>(null);

  constructor() {
    this.tenantSvc.tenant().subscribe({
      next: (t) => {
        this.tenant.set(t);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
