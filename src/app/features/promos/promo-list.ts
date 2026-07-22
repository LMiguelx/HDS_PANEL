import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { ToastService } from '../../core/ui/toast';
import { PromoService } from './promo';
import { PromoSummary } from '../../shared/models/promo.models';
import { promoTypeLabel } from '../../shared/ui/promo';

@Component({
  selector: 'app-promo-list',
  imports: [
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    PageHeaderComponent,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <app-page-header title="Promociones" subtitle="Vigentes hoy">
        <a
          *hasPermission="'promo.create'"
          mat-flat-button
          color="tertiary"
          routerLink="/promos/nueva"
        >
          <mat-icon>add</mat-icon> Nueva promo
        </a>
        <div class="goto">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Abrir promo por ID</mat-label>
            <input
              matInput
              type="number"
              [value]="gotoId() ?? ''"
              (input)="gotoId.set(+$any($event.target).value || null)"
              (keyup.enter)="openById()"
            />
          </mat-form-field>
          <button mat-stroked-button [disabled]="!gotoId()" (click)="openById()">Abrir</button>
        </div>
      </app-page-header>

      <div class="grid">
        @for (p of promos(); track p.promoId) {
          <mat-card class="promo">
            <div class="ptop">
              <div>
                <strong>{{ p.name }}</strong>
                <p class="muted small">{{ p.code }} · {{ typeLabel(p.promoType) }}</p>
              </div>
              <span class="status-chip" [attr.data-status]="p.active ? 'DELIVERED' : 'PENDING'">
                {{ p.active ? 'Activa' : 'Apagada' }}
              </span>
            </div>
            <p class="muted small">
              Vigencia: {{ p.startDate | date: 'dd/MM/yyyy' }} –
              {{ p.endDate | date: 'dd/MM/yyyy' }}
            </p>
            <div class="pactions">
              <button mat-button (click)="open(p)">Ver</button>
              <button *hasPermission="'promo.approve'" mat-stroked-button (click)="deactivate(p)">
                Apagar
              </button>
            </div>
          </mat-card>
        } @empty {
          <p class="muted">No hay promociones vigentes.</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .goto {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      }
      .promo {
        padding: 16px;
      }
      .ptop {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }
      .ptop p {
        margin: 2px 0 0;
      }
      .small {
        font-size: 0.82rem;
      }
      .pactions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 8px;
      }
    `,
  ],
})
export class PromoListPage {
  private promoSvc = inject(PromoService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly promos = signal<PromoSummary[]>([]);
  readonly gotoId = signal<number | null>(null);

  constructor() {
    this.load();
  }

  typeLabel(code: string) {
    return promoTypeLabel(code);
  }

  open(p: PromoSummary) {
    void this.router.navigate(['/promos', p.promoId]);
  }
  openById() {
    const id = this.gotoId();
    if (id) void this.router.navigate(['/promos', id]);
  }

  deactivate(p: PromoSummary) {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Apagar promoción',
          message: `"${p.name}" dejará de aplicar.`,
          confirmText: 'Apagar',
          danger: true,
        },
        width: '380px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.promoSvc.deactivate(p.promoId).subscribe(() => {
          this.toast.success('Promoción apagada');
          this.load();
        });
      });
  }

  private load() {
    this.promoSvc
      .current()
      .subscribe({ next: (p) => this.promos.set(p), error: () => this.promos.set([]) });
  }
}
