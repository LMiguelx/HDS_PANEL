import { Component, inject, signal } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CatalogService } from '../sales/catalog';
import { Product } from '../../shared/models/catalog.models';

/** Diálogo para elegir un producto del catálogo. Devuelve el Product elegido. */
@Component({
  selector: 'app-product-picker-dialog',
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Elegir producto</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full" subscriptSizing="dynamic">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>Buscar producto</mat-label>
        <input
          matInput
          [value]="q()"
          (input)="q.set($any($event.target).value)"
          (keyup.enter)="search()"
        />
      </mat-form-field>
      <div class="results">
        @for (p of results(); track p.productId) {
          <button class="row-item" [mat-dialog-close]="p">
            <span>{{ p.name }}</span>
            @if (p.familyName) {
              <span class="muted">{{ p.familyName }}</span>
            }
          </button>
        } @empty {
          <p class="muted">Busca un producto por nombre.</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end"
      ><button mat-button mat-dialog-close>Cerrar</button></mat-dialog-actions
    >
  `,
  styles: [
    `
      .full {
        width: 100%;
      }
      .results {
        display: flex;
        flex-direction: column;
        margin-top: 8px;
        min-width: 340px;
        max-height: 320px;
        overflow: auto;
      }
      .row-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        text-align: left;
        width: 100%;
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        font: inherit;
      }
      .row-item:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }
    `,
  ],
})
export class ProductPickerDialog {
  private catalog = inject(CatalogService);
  readonly q = signal('');
  readonly results = signal<Product[]>([]);

  search() {
    this.catalog.products(this.q().trim(), 0, 12).subscribe({
      next: (r) => this.results.set(r.content),
      error: () => this.results.set([]),
    });
  }
}
