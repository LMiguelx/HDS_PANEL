import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header';
import {
  ColumnDef,
  FetchFn,
  PaginatedTableComponent,
} from '../../shared/components/paginated-table';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { DeliveryService } from './delivery';
import { BatchSummary } from '../../shared/models/delivery.models';
import { formatSoles } from '../../shared/pipes/money';
import { statusLabel } from '../../shared/ui/status';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-batches-list',
  imports: [
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    PaginatedTableComponent,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <app-page-header title="Reparto" subtitle="Planillas del día">
        <a
          *hasPermission="'delivery.settle'"
          mat-flat-button
          color="tertiary"
          routerLink="/reparto/nueva"
        >
          <mat-icon>add</mat-icon>
          Nueva planilla
        </a>
      </app-page-header>

      <div class="filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Fecha</mat-label>
          <input
            matInput
            type="date"
            [value]="date()"
            (input)="date.set($any($event.target).value)"
          />
        </mat-form-field>
      </div>

      <app-paginated-table
        [columns]="columns"
        [fetch]="fetch"
        [reloadKey]="date()"
        [clickable]="true"
        emptyText="No hay planillas en esta fecha."
        (rowClick)="open($event)"></app-paginated-table>
    </div>
  `,
  styles: [
    `
      .filters {
        margin-bottom: 12px;
      }
    `,
  ],
})
export class BatchesListPage {
  private delivery = inject(DeliveryService);
  private router = inject(Router);

  readonly date = signal(today());

  readonly columns: ColumnDef<BatchSummary>[] = [
    { key: 'number', header: 'N°', cell: (b) => `${b.series}-${b.number}` },
    { key: 'vehiclePlate', header: 'Vehículo', cell: (b) => b.vehiclePlate },
    { key: 'statusCode', header: 'Estado', cell: (b) => statusLabel(b.statusCode) },
    { key: 'items', header: 'Pend./Total', cell: (b) => `${b.pendingItems}/${b.totalItems}` },
    { key: 'totalWeight', header: 'Peso', cell: (b) => `${b.totalWeight} kg`, align: 'end' },
    { key: 'totalAmount', header: 'Total', cell: (b) => formatSoles(b.totalAmount), align: 'end' },
  ];

  readonly fetch: FetchFn<BatchSummary> = (page, size) =>
    this.delivery.batches(this.date(), page, size);

  open(b: BatchSummary) {
    void this.router.navigate(['/reparto', b.batchId]);
  }
}
