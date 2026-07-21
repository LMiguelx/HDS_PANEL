import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { ToastService } from '../../core/ui/toast';
import { CustomerService } from '../customers/customer';
import { SegmentService } from './segment';
import { Segment, SegmentMember } from '../../shared/models/segment.models';
import { CustomerSummary } from '../../shared/models/customer.models';

@Component({
  selector: 'app-segments',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Segmentos" subtitle="Grupos de clientes para apuntar promos"></app-page-header>

      <div class="split">
        <!-- Lista de segmentos -->
        <mat-card class="card panel">
          <h3>Segmentos</h3>
          @for (s of segments(); track s.segmentId) {
            <button
              class="seg"
              [class.sel]="selected()?.segmentId === s.segmentId"
              (click)="select(s)"
            >
              <span>{{ s.name }}</span>
              @if (s.segmentType === 'RULE_BASED') {
                <span class="tag">auto</span>
              }
            </button>
          } @empty {
            <p class="muted">Sin segmentos.</p>
          }

          <div class="new">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
              <mat-label>Nuevo segmento</mat-label>
              <input
                matInput
                [value]="newName()"
                (input)="newName.set($any($event.target).value)"
                (keyup.enter)="createSegment()"
              />
            </mat-form-field>
            <button
              mat-flat-button
              color="primary"
              [disabled]="!newName().trim()"
              (click)="createSegment()"
            >
              Crear
            </button>
          </div>
        </mat-card>

        <!-- Miembros -->
        <mat-card class="card panel">
          @if (selected(); as s) {
            <h3>{{ s.name }} · miembros ({{ members().length }})</h3>

            @if (s.segmentType === 'RULE_BASED') {
              <p class="muted">Segmento automático (se llena por reglas/métricas). Solo lectura.</p>
            } @else {
              <div class="row">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
                  <mat-icon matPrefix>search</mat-icon>
                  <mat-label>Agregar cliente</mat-label>
                  <input
                    matInput
                    [value]="custQuery()"
                    (input)="custQuery.set($any($event.target).value)"
                    (keyup.enter)="searchCustomers()"
                  />
                </mat-form-field>
                <button mat-flat-button color="primary" (click)="searchCustomers()">Buscar</button>
              </div>
              @if (custResults().length) {
                <div class="results">
                  @for (c of custResults(); track c.customerId) {
                    <button class="row-item" (click)="addMember(c)">
                      <span>{{ c.businessName }}</span
                      >
                      <mat-icon>add</mat-icon>
                    </button>
                  }
                </div>
              }
            }

            <div class="members">
              @for (m of members(); track m.customerId) {
                <div class="member">
                  <span>{{ m.businessName }}</span>
                  @if (s.segmentType !== 'RULE_BASED') {
                    <button mat-icon-button (click)="removeMember(m)" aria-label="Quitar">
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                </div>
              } @empty {
                <p class="muted">Sin clientes en este segmento.</p>
              }
            </div>
          } @else {
            <p class="muted">Elige un segmento para ver sus miembros.</p>
          }
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .split {
        display: grid;
        gap: 16px;
        grid-template-columns: minmax(240px, 320px) 1fr;
        align-items: start;
      }
      @media (max-width: 720px) {
        .split {
          grid-template-columns: 1fr;
        }
      }
      .panel {
        padding: 16px;
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .seg {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 10px 12px;
        border-radius: 8px;
        font: inherit;
      }
      .seg:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }
      .seg.sel {
        background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
        color: var(--mat-sys-primary);
        font-weight: 600;
      }
      .tag {
        font-size: 0.7rem;
        background: var(--mat-sys-surface-container-high);
        padding: 1px 8px;
        border-radius: 999px;
        color: var(--mat-sys-on-surface-variant);
      }
      .new {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        align-items: center;
      }
      .grow {
        flex: 1 1 auto;
      }
      .row {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
      }
      .results {
        display: flex;
        flex-direction: column;
        margin-bottom: 12px;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
      }
      .row-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 8px 12px;
        font: inherit;
      }
      .row-item:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }
      .member {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    `,
  ],
})
export class SegmentsPage {
  private segmentsSvc = inject(SegmentService);
  private customers = inject(CustomerService);
  private toast = inject(ToastService);

  readonly segments = signal<Segment[]>([]);
  readonly selected = signal<Segment | null>(null);
  readonly members = signal<SegmentMember[]>([]);

  readonly newName = signal('');
  readonly custQuery = signal('');
  readonly custResults = signal<CustomerSummary[]>([]);

  constructor() {
    this.loadSegments();
  }

  createSegment() {
    const name = this.newName().trim();
    if (!name) return;
    this.segmentsSvc.create({ name }).subscribe(() => {
      this.toast.success('Segmento creado');
      this.newName.set('');
      this.loadSegments();
    });
  }

  select(s: Segment) {
    this.selected.set(s);
    this.custResults.set([]);
    this.custQuery.set('');
    this.loadMembers(s.segmentId);
  }

  searchCustomers() {
    const q = this.custQuery().trim();
    if (!q) return;
    this.customers.search(q, 0, 10).subscribe({
      next: (r) => this.custResults.set(r.content),
      error: () => this.custResults.set([]),
    });
  }

  addMember(c: CustomerSummary) {
    const s = this.selected();
    if (!s) return;
    this.segmentsSvc.addMember(s.segmentId, c.customerId).subscribe(() => {
      this.toast.success('Cliente agregado');
      this.custResults.set([]);
      this.custQuery.set('');
      this.loadMembers(s.segmentId);
    });
  }

  removeMember(m: SegmentMember) {
    const s = this.selected();
    if (!s) return;
    this.segmentsSvc.removeMember(s.segmentId, m.customerId).subscribe(() => {
      this.toast.success('Cliente quitado');
      this.loadMembers(s.segmentId);
    });
  }

  private loadSegments() {
    this.segmentsSvc.list().subscribe({
      next: (s) => this.segments.set(s),
      error: () => this.segments.set([]),
    });
  }

  private loadMembers(id: number) {
    this.segmentsSvc.members(id).subscribe({
      next: (m) => this.members.set(m),
      error: () => this.members.set([]),
    });
  }
}
