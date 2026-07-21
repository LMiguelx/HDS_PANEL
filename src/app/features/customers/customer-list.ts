import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
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
import { CustomerService } from './customer';
import { CustomerSummary } from '../../shared/models/customer.models';
import { PageResponse } from '../../shared/models/api.models';

@Component({
  selector: 'app-customer-list',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    PaginatedTableComponent,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Clientes" subtitle="Cartera y búsqueda">
        <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Buscar cliente</mat-label>
          <input
            matInput
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keyup.enter)="search()"
          />
        </mat-form-field>
        <button mat-flat-button color="primary" (click)="search()">Buscar</button>
      </app-page-header>

      <app-paginated-table
        [columns]="columns"
        [fetch]="fetch"
        [reloadKey]="searchKey()"
        [clickable]="true"
        emptyText="No se encontraron clientes."
        (rowClick)="open($event)"
      ></app-paginated-table>
    </div>
  `,
  styles: [
    `
      .search {
        min-width: 260px;
      }
    `,
  ],
})
export class CustomerListPage {
  private customers = inject(CustomerService);
  private router = inject(Router);

  readonly query = signal('');
  readonly searchKey = signal(0);

  readonly columns: ColumnDef<CustomerSummary>[] = [
    { key: 'businessName', header: 'Negocio', cell: (c) => c.businessName },
    { key: 'documentNumber', header: 'Documento', cell: (c) => c.documentNumber },
    { key: 'address', header: 'Dirección', cell: (c) => c.address ?? '—' },
    { key: 'type', header: 'Tipo', cell: (c) => c.customerTypeName ?? '—' },
    { key: 'status', header: 'Estado', cell: (c) => (c.active ? 'Activo' : 'Inactivo') },
  ];

  // Sin texto → muestra la cartera; con texto → búsqueda paginada.
  readonly fetch: FetchFn<CustomerSummary> = (page, size) => {
    const q = this.query().trim();
    if (!q) {
      return this.customers.portfolio().pipe(
        map(
          (list) =>
            ({
              content: list,
              page: 0,
              size: list.length,
              totalElements: list.length,
              totalPages: 1,
              first: true,
              last: true,
            }) as PageResponse<CustomerSummary>,
        ),
      );
    }
    return this.customers.search(q, page, size);
  };

  search() {
    this.searchKey.update((n) => n + 1);
  }

  open(c: CustomerSummary) {
    void this.router.navigate(['/clientes', c.customerId]);
  }
}
