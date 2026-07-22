import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header';
import {
  ColumnDef,
  FetchFn,
  PaginatedTableComponent,
} from '../../shared/components/paginated-table';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { ToastService } from '../../core/ui/toast';
import { InvoiceService } from './invoice';
import { InvoiceSummary } from '../../shared/models/invoice.models';
import { formatSoles } from '../../shared/pipes/money';
import { statusLabel } from '../../shared/ui/status';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-PE');
}

@Component({
  selector: 'app-invoices-inbox',
  imports: [
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    PaginatedTableComponent,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <app-page-header title="Facturación" subtitle="Facturas sin conciliar">
        <input #file type="file" accept="application/json" hidden (change)="onFile($event)" />
        <button
          *hasPermission="'product.sync'"
          mat-stroked-button
          [disabled]="importing()"
          (click)="file.click()"
        >
          <mat-icon>upload_file</mat-icon>
          Importar
        </button>
        <button
          *hasPermission="'invoice.reconcile'"
          mat-flat-button
          color="tertiary"
          [disabled]="matching()"
          (click)="autoMatch()"
        >
          <mat-icon>auto_fix_high</mat-icon>
          Conciliar automáticamente
        </button>
      </app-page-header>

      <app-paginated-table
        [columns]="columns"
        [fetch]="fetch"
        [reloadKey]="reloadKey()"
        [clickable]="true"
        emptyText="No hay facturas sin conciliar."
        (rowClick)="open($event)"></app-paginated-table>
    </div>
  `,
})
export class InvoicesInboxPage {
  private invoices = inject(InvoiceService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly reloadKey = signal(0);
  readonly importing = signal(false);
  readonly matching = signal(false);

  readonly columns: ColumnDef<InvoiceSummary>[] = [
    { key: 'invoiceId', header: 'Factura', cell: (i) => i.invoiceId },
    { key: 'customerName', header: 'Cliente', cell: (i) => i.customerName },
    { key: 'issueDate', header: 'Fecha', cell: (i) => fmtDate(i.issueDate) },
    { key: 'matchStatus', header: 'Estado', cell: (i) => statusLabel(i.matchStatus) },
    { key: 'totalAmount', header: 'Total', cell: (i) => formatSoles(i.totalAmount), align: 'end' },
  ];

  readonly fetch: FetchFn<InvoiceSummary> = (page, size) => this.invoices.unmatched(page, size);

  open(i: InvoiceSummary) {
    void this.router.navigate(['/facturas', i.invoiceId]);
  }

  autoMatch() {
    this.matching.set(true);
    this.invoices.autoMatch().subscribe({
      next: (r) => {
        this.matching.set(false);
        this.toast.success(`${r?.matched ?? 0} facturas conciliadas`);
        this.reloadKey.update((n) => n + 1);
      },
      error: () => this.matching.set(false),
    });
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.importing.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(reader.result));
      } catch {
        this.importing.set(false);
        this.toast.error('El archivo no es un JSON válido');
        return;
      }
      this.invoices.importInvoices(payload).subscribe({
        next: (r) => {
          this.importing.set(false);
          this.toast.success(`Importadas ${r?.imported ?? 0}, omitidas ${r?.skipped ?? 0}`);
          this.reloadKey.update((n) => n + 1);
        },
        error: () => this.importing.set(false),
      });
    };
    reader.onerror = () => {
      this.importing.set(false);
      this.toast.error('No se pudo leer el archivo');
    };
    reader.readAsText(f);
  }
}
