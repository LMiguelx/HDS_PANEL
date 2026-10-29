import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { CustomerService } from '../customer';
import { CustomerDetail } from '../../../shared/models/customer.models';

export interface RatingDialogData {
  customerId: number;
  businessName: string;
  currentRating: number | null;
}

const STARS = [1, 2, 3, 4, 5];

/** Califica al cliente (1-5) — PATCH /api/admin/customers/{id}/rating. */
@Component({
  selector: 'app-rating-dialog',
  imports: [UiButton],
  template: `
    <div class="rd">
      <h2 class="rd-title">Calificar cliente</h2>
      <p class="rd-sub">{{ data.businessName }}</p>

      <div class="rd-stars">
        @for (n of stars; track n) {
          <button
            type="button"
            class="rd-star"
            [class.filled]="n <= (rating() ?? 0)"
            [attr.aria-label]="n + ' de 5'"
            (click)="rating.set(n)"
          >
            ★
          </button>
        }
      </div>

      @if (error()) {
        <div class="rd-error">{{ error() }}</div>
      }

      <div class="rd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button
          uiButton
          variant="primary"
          [loading]="saving()"
          [disabled]="!rating()"
          (click)="submit()"
        >
          Guardar calificación
        </button>
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .rd {
        display: grid;
        gap: 16px;
      }
      .rd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .rd-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .rd-stars {
        display: flex;
        gap: 4px;
      }
      .rd-star {
        appearance: none;
        border: 0;
        background: transparent;
        cursor: pointer;
        font-size: 32px;
        line-height: 1;
        color: var(--hairline);
        padding: 2px;
      }
      .rd-star.filled {
        color: var(--accent);
      }
      .rd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .rd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class RatingDialog {
  protected data = inject<RatingDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<CustomerDetail | false>);
  private customerSvc = inject(CustomerService);

  protected stars = STARS;
  protected rating = signal<number | null>(this.data.currentRating);
  protected saving = signal(false);
  protected error = signal('');

  protected submit() {
    const rating = this.rating();
    if (!rating) return;
    this.saving.set(true);
    this.error.set('');
    this.customerSvc.rate(this.data.customerId, { rating }).subscribe({
      next: (detail) => {
        this.saving.set(false);
        this.ref.close(detail);
      },
      error: (err) => {
        this.saving.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(
          detalle ? `No pudimos calificar: ${detalle}` : 'No pudimos guardar la calificación.',
        );
      },
    });
  }
}
