import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { PageResponse } from '../models/api.models';

export interface ColumnDef<T = any> {
  key: string;
  header: string;
  cell: (row: T) => string;
  align?: 'start' | 'end';
}

export type FetchFn<T = any> = (page: number, size: number) => Observable<PageResponse<T>>;

/**
 * Tabla paginada reutilizable.
 *   <app-paginated-table
 *     [columns]="cols" [fetch]="fetch" [reloadKey]="searchKey()"
 *     [clickable]="true" (rowClick)="open($event)" />
 * Cambia `reloadKey` para forzar recarga desde la página 0 (ej. nueva búsqueda).
 */
@Component({
  selector: 'app-paginated-table',
  imports: [MatTableModule, MatPaginatorModule, MatIconModule],
  template: `
    <div class="ptable">
      @if (loading() && !data().length) {
        <div class="skeleton" aria-hidden="true">
          <div class="sk-row sk-header">
            @for (col of columns(); track col.key) {
              <div class="sk-cell" [class.sk-narrow]="col.align === 'end'"></div>
            }
          </div>
          @for (r of skeletonRows(); track r) {
            <div class="sk-row">
              @for (col of columns(); track col.key) {
                <div class="sk-cell" [class.sk-narrow]="col.align === 'end'"></div>
              }
            </div>
          }
        </div>
      } @else {
        @if (loading()) {
          <div class="refresh-hint">
            <span class="dot"></span>
            Actualizando…
          </div>
        }
        <table mat-table [dataSource]="data()" [class.refreshing]="loading()">
          @for (col of columns(); track col.key) {
            <ng-container [matColumnDef]="col.key">
              <th mat-header-cell *matHeaderCellDef [style.text-align]="col.align ?? 'start'">
                {{ col.header }}
              </th>
              <td mat-cell *matCellDef="let row" [style.text-align]="col.align ?? 'start'">
                {{ col.cell(row) }}
              </td>
            </ng-container>
          }
          <tr mat-header-row *matHeaderRowDef="displayed()"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: displayed()"
            [class.clickable]="clickable()"
            (click)="clickable() ? rowClick.emit(row) : null"
          ></tr>
        </table>

        @if (!loading() && data().length === 0) {
          <div class="empty">
            <mat-icon>inbox</mat-icon>
            <p>{{ emptyText() }}</p>
          </div>
        }
      }

      <mat-paginator
        [length]="total()"
        [pageSize]="pageSize()"
        [pageIndex]="pageIndex()"
        [pageSizeOptions]="[10, 20, 50]"
        (page)="onPage($event)"
      />
    </div>
  `,
  styles: [
    `
      .ptable {
        position: relative;
      }
      table {
        width: 100%;
      }
      tr.clickable {
        cursor: pointer;
      }
      tr.clickable:hover td {
        background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 40px 0;
        color: var(--mat-sys-on-surface-variant);
      }
      .empty mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        opacity: 0.6;
      }

      /* ---- Skeleton (carga inicial) ---- */
      .skeleton {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding-top: 4px;
      }
      .sk-row {
        display: flex;
        gap: var(--sp-6, 24px);
        align-items: center;
        padding: 12px var(--sp-4, 16px);
      }
      .sk-header {
        padding-top: 0;
      }
      .sk-header .sk-cell {
        height: 10px;
        opacity: 0.5;
      }
      .sk-cell {
        flex: 1 1 0;
        height: 14px;
        border-radius: var(--radius-sm, 8px);
        background: var(--mat-sys-surface-container-highest, rgba(0, 0, 0, 0.08));
        animation: sk-pulse 1.4s ease-in-out infinite;
      }
      .sk-cell.sk-narrow {
        flex: 0 0 72px;
      }
      @keyframes sk-pulse {
        0%,
        100% {
          opacity: 0.55;
        }
        50% {
          opacity: 1;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .sk-cell {
          animation: none;
          opacity: 0.7;
        }
      }

      /* ---- Aviso de recarga (ya hay datos, se está paginando/refrescando) ---- */
      .refresh-hint {
        position: absolute;
        top: -2px;
        right: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: var(--mat-sys-on-surface-variant);
      }
      .refresh-hint .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--mat-sys-tertiary, currentColor);
      }
      table.refreshing {
        opacity: 0.6;
        pointer-events: none;
        transition: opacity 0.15s ease;
      }
      @media (prefers-reduced-motion: reduce) {
        table.refreshing {
          transition: none;
        }
      }
    `,
  ],
})
export class PaginatedTableComponent {
  readonly columns = input.required<ColumnDef[]>();
  readonly fetch = input.required<FetchFn>();
  readonly reloadKey = input<unknown>(null);
  readonly emptyText = input('No hay datos.');
  readonly clickable = input(false);
  readonly rowClick = output<any>();

  readonly data = signal<any[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  readonly displayed = computed(() => this.columns().map((c) => c.key));
  readonly skeletonRows = computed(() => Array.from({ length: Math.min(this.pageSize(), 8) }));

  constructor() {
    // Recarga (desde page 0) cada vez que cambia reloadKey. También corre al inicio.
    effect(() => {
      this.reloadKey();
      untracked(() => {
        this.pageIndex.set(0);
        this.load();
      });
    });
  }

  onPage(e: PageEvent) {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.fetch()(this.pageIndex(), this.pageSize()).subscribe({
      next: (r) => {
        this.data.set(r.content);
        this.total.set(r.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.data.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }
}
