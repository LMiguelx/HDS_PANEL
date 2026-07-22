import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { MoneyPipe } from '../../shared/pipes/money';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { statusLabel } from '../../shared/ui/status';
import { AuthService } from '../../core/auth/auth';
import { ToastService } from '../../core/ui/toast';
import { DeliveryService } from './delivery';
import { ReturnDialog } from './return-dialog';
import { BatchDetail, BatchItemView, ReturnView } from '../../shared/models/delivery.models';

@Component({
  selector: 'app-batch-detail',
  imports: [
    DatePipe,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    PageHeaderComponent,
    MoneyPipe,
  ],
  template: `
    <div class="page">
      <app-page-header [title]="titleText()" [subtitle]="batch()?.driverName ?? ''">
        <a mat-stroked-button routerLink="/reparto"><mat-icon>arrow_back</mat-icon> Volver</a>
        @if (batch(); as b) {
          @if (canStartRoute()) {
            <button mat-flat-button color="tertiary" (click)="startRoute()">
              <mat-icon>play_arrow</mat-icon> Iniciar ruta
            </button>
          }
          @if (canSettle()) {
            <button
              mat-flat-button
              color="tertiary"
              [disabled]="pendingCount() > 0"
              (click)="settle()"
            >
              <mat-icon>done_all</mat-icon> Liquidar
            </button>
          }
        }
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (batch(); as b) {
        <mat-card class="card">
          <div class="head">
            <div>
              <span class="muted">Estado</span><br /><span
                class="status-chip"
                [attr.data-status]="b.statusCode"
                >{{ label(b.statusCode) }}</span
              >
            </div>
            <div><span class="muted">Fecha</span><br />{{ b.batchDate | date: 'dd/MM/yyyy' }}</div>
            <div><span class="muted">Vehículo</span><br />{{ b.vehiclePlate }}</div>
            <div><span class="muted">Peso</span><br />{{ b.totalWeight }} kg</div>
            <div>
              <span class="muted">Total</span><br /><strong class="money">{{
                b.totalAmount | money
              }}</strong>
            </div>
            <div>
              <span class="muted">Avance</span><br />{{ b.items.length - pendingCount() }}/{{
                b.items.length
              }}
              resueltos
            </div>
          </div>
          @if (b.statusCode === 'IN_ROUTE' && pendingCount() > 0) {
            <p class="muted small">
              Quedan {{ pendingCount() }} comprobantes pendientes; no se puede liquidar aún.
            </p>
          }
        </mat-card>

        <mat-card class="card">
          <h3>Comprobantes ({{ b.items.length }})</h3>
          @for (it of b.items; track it.invoiceId) {
            <div class="item">
              <div class="line">
                <span class="ln">#{{ it.lineNumber }}</span>
                <div class="info">
                  <strong>{{ it.invoiceId }}</strong>
                  <span class="muted">{{ it.customerName }}</span>
                </div>
                <span class="money">{{ it.amount | money }}</span>
                <span class="status-chip" [attr.data-status]="it.statusCode">{{
                  label(it.statusCode)
                }}</span>
              </div>

              <div class="tools">
                @if (canMark()) {
                  <div class="marks">
                    <button class="ok" (click)="mark(it, 'DELIVERED')">
                      <mat-icon>check</mat-icon> Entregado
                    </button>
                    <button class="mid" (click)="mark(it, 'PARTIAL')">
                      <mat-icon>adjust</mat-icon> Parcial
                    </button>
                    <button class="bad" (click)="mark(it, 'REJECTED')">
                      <mat-icon>close</mat-icon> Rechazado
                    </button>
                  </div>
                }
                @if (canReturn()) {
                  <button mat-button (click)="openReturn(it)">
                    <mat-icon>assignment_return</mat-icon> Devolución
                  </button>
                }
                <button mat-button (click)="toggleReturns(it)">
                  <mat-icon>{{
                    expanded() === it.invoiceId ? 'expand_less' : 'expand_more'
                  }}</mat-icon>
                  Ver devoluciones
                </button>
              </div>

              @if (expanded() === it.invoiceId) {
                <div class="returns">
                  @for (r of returnsFor()[it.invoiceId] ?? []; track $index) {
                    <div class="rrow">
                      <span>{{ r.productName ?? 'Producto #' + r.productId }}</span>
                      <span class="muted">× {{ r.quantity }} · {{ r.amount | money }}</span>
                      <span class="muted">{{ r.returnReasonName ?? '' }}</span>
                    </div>
                  } @empty {
                    <p class="muted small">Sin devoluciones para este comprobante.</p>
                  }
                </div>
              }
            </div>
          }
        </mat-card>
      } @else {
        <p class="muted">No se encontró la planilla.</p>
      }
    </div>
  `,
  styles: [
    `
      .card {
        padding: 20px;
        margin-bottom: 16px;
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
      }
      .small {
        font-size: 0.82rem;
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .item {
        padding: 12px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .line {
        display: grid;
        grid-template-columns: 40px 1fr auto auto;
        gap: 12px;
        align-items: center;
      }
      .info {
        display: flex;
        flex-direction: column;
      }
      .ln {
        color: var(--mat-sys-on-surface-variant);
      }
      .tools {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-top: 8px;
      }
      .marks {
        display: flex;
        gap: 6px;
      }
      .marks button {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1px solid var(--mat-sys-outline);
        background: transparent;
        border-radius: 999px;
        padding: 4px 12px;
        cursor: pointer;
        font: inherit;
      }
      .marks .ok:hover {
        background: color-mix(in srgb, var(--st-delivered) 18%, transparent);
        border-color: var(--st-delivered);
      }
      .marks .mid:hover {
        background: color-mix(in srgb, var(--st-partial) 18%, transparent);
        border-color: var(--st-partial);
      }
      .marks .bad:hover {
        background: color-mix(in srgb, var(--st-rejected) 18%, transparent);
        border-color: var(--st-rejected);
      }
      .marks mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .returns {
        margin: 8px 0 0 52px;
        padding-left: 12px;
        border-left: 2px solid var(--mat-sys-outline-variant);
      }
      .rrow {
        display: flex;
        gap: 16px;
        padding: 4px 0;
      }
    `,
  ],
})
export class BatchDetailPage {
  private delivery = inject(DeliveryService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly id = input.required<string>();
  readonly loading = signal(true);
  readonly batch = signal<BatchDetail | null>(null);
  readonly expanded = signal<string | null>(null);
  readonly returnsFor = signal<Record<string, ReturnView[]>>({});

  readonly titleText = computed(() => {
    const b = this.batch();
    return b ? `Planilla ${b.series}-${b.number}` : `Planilla #${this.id()}`;
  });
  readonly pendingCount = computed(
    () => this.batch()?.items.filter((i) => i.statusCode === 'PENDING').length ?? 0,
  );

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.load(id));
    });
  }

  label(code: string) {
    return statusLabel(code);
  }

  canStartRoute() {
    return this.batch()?.statusCode === 'OPEN' && this.auth.has('delivery.deliver');
  }
  canMark() {
    return this.batch()?.statusCode === 'IN_ROUTE' && this.auth.has('delivery.deliver');
  }
  canReturn() {
    return this.batch()?.statusCode === 'IN_ROUTE' && this.auth.has('delivery.return');
  }
  canSettle() {
    return this.batch()?.statusCode === 'IN_ROUTE' && this.auth.has('delivery.settle');
  }

  startRoute() {
    const b = this.batch();
    if (!b) return;
    this.delivery.startRoute(b.batchId).subscribe({
      next: () => {
        this.toast.success('Ruta iniciada');
        this.reload();
      },
      error: () => {},
    });
  }

  mark(it: BatchItemView, status: string) {
    const b = this.batch();
    if (!b) return;
    this.delivery.markItem(b.batchId, { invoiceId: it.invoiceId, status }).subscribe({
      next: () => {
        if (status === 'PARTIAL' || status === 'REJECTED') {
          this.openReturn(it, true);
        } else {
          this.toast.success('Marcado como entregado');
          this.reload();
        }
      },
      error: () => {},
    });
  }

  openReturn(it: BatchItemView, reloadAfter = false) {
    this.dialog
      .open(ReturnDialog, {
        width: '520px',
        data: { invoiceId: it.invoiceId, customerName: it.customerName },
      })
      .afterClosed()
      .subscribe(() => {
        this.returnsFor.update((m) => {
          const c = { ...m };
          delete c[it.invoiceId];
          return c;
        });
        if (reloadAfter) this.reload();
        else if (this.expanded() === it.invoiceId) this.loadReturns(it.invoiceId);
      });
  }

  toggleReturns(it: BatchItemView) {
    if (this.expanded() === it.invoiceId) {
      this.expanded.set(null);
      return;
    }
    this.expanded.set(it.invoiceId);
    if (!this.returnsFor()[it.invoiceId]) this.loadReturns(it.invoiceId);
  }

  settle() {
    const b = this.batch();
    if (!b) return;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Liquidar planilla',
          message: `Se cerrará la planilla ${b.series}-${b.number}.`,
          confirmText: 'Liquidar',
        },
        width: '380px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.delivery.settle(b.batchId).subscribe({
          next: () => {
            this.toast.success('Planilla liquidada');
            this.reload();
          },
          error: () => {},
        });
      });
  }

  private loadReturns(invoiceId: string) {
    this.delivery.returnsByInvoice(invoiceId).subscribe({
      next: (r) => this.returnsFor.update((m) => ({ ...m, [invoiceId]: r })),
      error: () => this.returnsFor.update((m) => ({ ...m, [invoiceId]: [] })),
    });
  }
  private reload() {
    this.load(Number(this.id()));
  }
  private load(id: number) {
    this.loading.set(true);
    this.batch.set(null);
    this.expanded.set(null);
    this.delivery.batch(id).subscribe({
      next: (b) => {
        this.batch.set(b);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
