import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../../shared/ui/button/button';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UiApprovalTray } from '../../../shared/ui/approval-tray/approval-tray';
import { UiStatusSteps, UiStatusStep } from '../../../shared/ui/status-steps/status-steps';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { ApprovalsStore } from '../approvals-store';
import { CustomerRequestAdminService } from '../customer-request-admin';
import { ErpBadge } from './erp-badge';
import { ErpFilterCounts, ErpFilterValue, ErpSegmentedFilter } from './segmented-filter';
import { erpStatusLabel } from '../request-format';
import { RequestView } from '../../../shared/models/customer-request.models';
import { dateTimeText } from '../../assignments/assignment-format';

/** Pestaña Cierre de la bandeja de Aprobaciones — doc 39, sección 7. */
@Component({
  selector: 'app-closure-tab',
  imports: [
    UiButton,
    UiEmpty,
    RouterLink,
    UiApprovalTray,
    UiStatusSteps,
    ErpBadge,
    ErpSegmentedFilter,
  ],
  templateUrl: './closure-tab.html',
  styleUrls: ['./closure-tab.scss'],
})
export class ClosureTab {
  private store = inject(ApprovalsStore);
  private svc = inject(CustomerRequestAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  selectedKey = input<string | null>(null);
  select = output<string | null>();

  protected String = String;
  protected rows = this.store.closureRows;
  protected dateTimeText = dateTimeText;
  protected erpStatusLabel = erpStatusLabel;

  protected filterValue = signal<ErpFilterValue>('all');
  protected filterCounts = computed<ErpFilterCounts>(() => {
    const rows = this.rows();
    return {
      all: rows.length,
      ready: rows.filter((r) => r.erpRegistered).length,
      waiting: rows.filter((r) => !r.erpRegistered).length,
    };
  });
  protected filteredRows = computed(() => {
    const rows = this.rows();
    const f = this.filterValue();
    if (f === 'ready') return rows.filter((r) => r.erpRegistered);
    if (f === 'waiting') return rows.filter((r) => !r.erpRegistered);
    return rows;
  });

  protected selected = computed<RequestView | null>(() => {
    const key = this.selectedKey();
    if (!key) return null;
    return this.rows().find((r) => String(r.requestId) === key) ?? null;
  });

  protected steps = computed<UiStatusStep[]>(() => {
    const r = this.selected();
    if (!r) return [];
    return [
      { label: 'Solicitada', state: 'complete', meta: dateTimeText(r.createdAt) },
      {
        label: 'Registrada en el ERP',
        state: r.erpRegistered ? 'complete' : 'current',
        meta: r.erpRegistered ? dateTimeText(r.erpRegisteredAt) : '',
      },
      { label: 'Aprobada', state: 'upcoming' },
    ];
  });

  protected acting = signal(false);
  protected actionError = signal('');
  protected errorHasOpenOrders = signal(false);

  constructor() {
    effect(() => {
      const loading = this.store.loading();
      untracked(() => {
        if (loading) return;
        this.ensureSelection(this.rows());
      });
    });
  }

  private ensureSelection(rows: RequestView[]) {
    const current = this.selectedKey();
    if (rows.length === 0) {
      if (current !== null) this.select.emit(null);
      return;
    }
    const exists = current !== null && rows.some((r) => String(r.requestId) === current);
    if (!exists) {
      if (current !== null) this.toast.info('Esta solicitud ya fue resuelta por otro usuario.');
      this.select.emit(String(rows[0].requestId));
    }
  }

  protected pick(requestId: number) {
    this.actionError.set('');
    this.errorHasOpenOrders.set(false);
    this.select.emit(String(requestId));
  }

  protected approve(r: RequestView) {
    if (!r.erpRegistered || this.acting()) return;
    this.dialog
      .confirm({
        title: 'Cerrar cliente',
        message: `¿Cerrar a ${r.businessName} (${r.customerCode})? El cliente quedará inactivo.`,
        confirmLabel: 'Cerrar cliente',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.acting.set(true);
        this.actionError.set('');
        this.errorHasOpenOrders.set(false);
        this.svc.approveClosure(r.requestId).subscribe({
          next: () => {
            this.acting.set(false);
            this.toast.success('Cliente cerrado.');
            this.store.loadAll();
          },
          error: (err) => {
            this.acting.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.actionError.set(detalle || 'No pudimos aprobar el cierre.');
            this.errorHasOpenOrders.set(!!detalle?.includes('pedido'));
            if (detalle?.includes('ya fue resuelta') || detalle?.includes('ya está inactivo')) {
              this.store.loadAll();
            }
          },
        });
      });
  }

  protected reject(r: RequestView) {
    if (r.erpRegistered || this.acting()) return;
    this.dialog
      .confirm({
        title: 'Rechazar cierre',
        message: `¿Rechazar el cierre de ${r.businessName}? El cliente sigue activo.`,
        confirmLabel: 'Rechazar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.acting.set(true);
        this.actionError.set('');
        this.svc.rejectClosure(r.requestId).subscribe({
          next: () => {
            this.acting.set(false);
            this.store.loadAll();
          },
          error: (err) => {
            this.acting.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.actionError.set(detalle || 'No pudimos rechazar el cierre.');
            if (detalle?.includes('ya fue resuelta')) this.store.loadAll();
          },
        });
      });
  }
}
