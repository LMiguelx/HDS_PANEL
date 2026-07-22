import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { ToastService } from '../../core/ui/toast';
import { PromoService } from './promo';
import { PromoBenefit, PromoCondition, PromoDetail } from '../../shared/models/promo.models';
import { benefitText, conditionText, promoTypeLabel } from '../../shared/ui/promo';

@Component({
  selector: 'app-promo-detail',
  imports: [
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    PageHeaderComponent,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <app-page-header [title]="promo()?.name ?? 'Promoción'" [subtitle]="promo()?.code ?? ''">
        <a mat-stroked-button routerLink="/promos"><mat-icon>arrow_back</mat-icon> Volver</a>
        @if (promo(); as p) {
          @if (!p.active) {
            <button
              *hasPermission="'promo.approve'"
              mat-flat-button
              color="tertiary"
              (click)="approve(p)"
            >
              <mat-icon>power_settings_new</mat-icon> Aprobar / encender
            </button>
          } @else {
            <button *hasPermission="'promo.approve'" mat-stroked-button (click)="deactivate(p)">
              <mat-icon>power_off</mat-icon> Apagar
            </button>
          }
        }
      </app-page-header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (promo(); as p) {
        <mat-card class="card">
          <div class="head">
            <div>
              <span class="muted">Estado</span><br />
              <span class="status-chip" [attr.data-status]="p.active ? 'DELIVERED' : 'PENDING'">
                {{ p.active ? 'Activa' : 'Apagada' }}
              </span>
            </div>
            <div><span class="muted">Tipo</span><br />{{ typeLabel(p.promoType) }}</div>
            <div>
              <span class="muted">Vigencia</span><br />{{ p.startDate | date: 'dd/MM/yyyy' }} –
              {{ p.endDate | date: 'dd/MM/yyyy' }}
            </div>
            <div><span class="muted">Se repite</span><br />{{ p.repeats ? 'Sí' : 'No' }}</div>
          </div>
          @if (p.description) {
            <p class="desc">{{ p.description }}</p>
          }
        </mat-card>

        <mat-card class="card">
          <h3>Condiciones</h3>
          @for (c of p.conditions; track $index) {
            <div class="line">{{ condText(c) }}</div>
          }
          @if (!p.conditions?.length) {
            <p class="muted">Sin condiciones (aplica según el tipo).</p>
          }
        </mat-card>

        <mat-card class="card">
          <h3>Tramos y beneficios</h3>
          @for (t of p.tiers; track t.tier) {
            <div class="tier">
              <strong>Tramo {{ t.tier }}</strong>
              <span class="muted">
                · desde {{ t.fromQuantity }} und
                @if (t.fromAmount) {
                  / S/ {{ t.fromAmount }}
                }
              </span>
              <ul>
                @for (b of t.benefits; track $index) {
                  <li>{{ benefText(b) }}</li>
                }
              </ul>
            </div>
          }
          @if (!p.tiers?.length) {
            <p class="muted">Sin tramos.</p>
          }
        </mat-card>
      } @else {
        <p class="muted">No se encontró la promoción.</p>
      }
    </div>
  `,
  styles: [
    `
      .card {
        padding: 20px;
        margin-bottom: 16px;
        max-width: 760px;
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
      }
      .desc {
        margin: 12px 0 0;
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .line {
        padding: 6px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .tier {
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .tier ul {
        margin: 6px 0 0;
        padding-left: 20px;
      }
    `,
  ],
})
export class PromoDetailPage {
  private promoSvc = inject(PromoService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly id = input.required<string>();

  readonly loading = signal(true);
  readonly promo = signal<PromoDetail | null>(null);

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.load(id));
    });
  }

  typeLabel(code: string) {
    return promoTypeLabel(code);
  }
  condText(c: PromoCondition) {
    return conditionText(c);
  }
  benefText(b: PromoBenefit) {
    return benefitText(b);
  }

  approve(p: PromoDetail) {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Aprobar / encender',
          message: 'Se encenderá y se notificará a los vendedores de los clientes elegibles.',
          confirmText: 'Aprobar',
        },
        width: '420px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.promoSvc.approve(p.promoId).subscribe(() => {
          this.toast.success('Promoción aprobada');
          this.load(p.promoId);
        });
      });
  }

  deactivate(p: PromoDetail) {
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
          this.load(p.promoId);
        });
      });
  }

  private load(id: number) {
    this.loading.set(true);
    this.promo.set(null);
    this.promoSvc.detail(id).subscribe({
      next: (p) => {
        this.promo.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
