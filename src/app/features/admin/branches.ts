import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { ToastService } from '../../core/ui/toast';
import { TenantService } from './tenant';
import { BranchView, CreateBranchCommand } from '../../shared/models/tenant.models';

@Component({
  selector: 'app-branches',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    HasPermissionDirective,
  ],
  template: `
    <mat-card class="card" *hasPermission="'config.edit'">
      <h3>Nueva sede</h3>
      <div class="form">
        <mat-form-field appearance="outline" subscriptSizing="dynamic"
          ><mat-label>Código</mat-label>
          <input matInput [value]="code()" (input)="code.set($any($event.target).value)"
        /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow"
          ><mat-label>Nombre</mat-label>
          <input matInput [value]="name()" (input)="name.set($any($event.target).value)"
        /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow"
          ><mat-label>Dirección</mat-label>
          <input matInput [value]="address()" (input)="address.set($any($event.target).value)"
        /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"
          ><mat-label>Ubigeo (6 dígitos)</mat-label>
          <input
            matInput
            inputmode="numeric"
            maxlength="6"
            [value]="ubigeo()"
            (input)="ubigeo.set($any($event.target).value)"
          />
          @if (ubigeo() && !ubigeoValid()) {
            <mat-hint class="err">Deben ser 6 dígitos</mat-hint>
          }
        </mat-form-field>
        <button mat-flat-button color="tertiary" [disabled]="!canCreate()" (click)="create()">
          <mat-icon>add</mat-icon> Agregar
        </button>
      </div>
    </mat-card>

    <mat-card class="card">
      <h3>Sedes activas</h3>
      <div class="list">
        <div class="brow head">
          <span>Código</span><span>Nombre</span><span>Dirección</span><span>Ubigeo</span
          ><span></span>
        </div>
        @for (b of branches(); track b.branchId) {
          <div class="brow">
            <span>{{ b.code }}</span>
            <span>{{ b.name }}</span>
            <span class="muted">{{ b.address }}</span>
            <span>{{ b.ubigeo }}</span>
            <button *hasPermission="'config.edit'" mat-button (click)="deactivate(b)">
              Cerrar
            </button>
          </div>
        } @empty {
          <p class="muted">No hay sedes activas.</p>
        }
      </div>
    </mat-card>
  `,
  styles: [
    `
      .card {
        padding: var(--sp-5);
        margin-bottom: var(--sp-4);
        max-width: var(--card-w-lg);
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .form {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        flex-wrap: wrap;
      }
      .grow {
        flex: 1 1 180px;
      }
      .err {
        color: var(--mat-sys-error);
      }
      .list {
        display: flex;
        flex-direction: column;
      }
      .brow {
        display: grid;
        grid-template-columns: 100px 1fr 1fr 90px 90px;
        gap: 8px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .brow.head {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.8rem;
        border-bottom: 2px solid var(--mat-sys-outline-variant);
      }
    `,
  ],
})
export class BranchesPage {
  private tenantSvc = inject(TenantService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly branches = signal<BranchView[]>([]);
  readonly code = signal('');
  readonly name = signal('');
  readonly address = signal('');
  readonly ubigeo = signal('');

  readonly ubigeoValid = computed(() => /^\d{6}$/.test(this.ubigeo()));
  readonly canCreate = computed(
    () =>
      !!this.code().trim() && !!this.name().trim() && !!this.address().trim() && this.ubigeoValid(),
  );

  constructor() {
    this.load();
  }

  create() {
    if (!this.canCreate()) return;
    const cmd: CreateBranchCommand = {
      code: this.code().trim(),
      name: this.name().trim(),
      address: this.address().trim(),
      ubigeo: this.ubigeo(),
    };
    this.tenantSvc.createBranch(cmd).subscribe({
      next: () => {
        this.toast.success('Sede creada');
        this.code.set('');
        this.name.set('');
        this.address.set('');
        this.ubigeo.set('');
        this.load();
      },
      error: () => {},
    });
  }

  deactivate(b: BranchView) {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Cerrar sede',
          message: `${b.code} · ${b.name}.`,
          confirmText: 'Cerrar',
          danger: true,
        },
        width: '380px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.tenantSvc.deactivateBranch(b.branchId).subscribe({
          next: () => {
            this.toast.success('Sede cerrada');
            this.load();
          },
          error: () => {},
        });
      });
  }

  private load() {
    this.tenantSvc
      .branches()
      .subscribe({ next: (b) => this.branches.set(b), error: () => this.branches.set([]) });
  }
}
