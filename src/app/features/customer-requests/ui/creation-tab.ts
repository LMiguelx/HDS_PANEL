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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { UiButton } from '../../../shared/ui/button/button';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UiTypeahead, UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UiApprovalTray } from '../../../shared/ui/approval-tray/approval-tray';
import { UiStatusSteps, UiStatusStep } from '../../../shared/ui/status-steps/status-steps';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { LookupService, toUiLookup } from '../../promos/lookup';
import { ApprovalsStore } from '../approvals-store';
import { CustomerRequestAdminService } from '../customer-request-admin';
import { ErpBadge } from './erp-badge';
import { ErpFilterCounts, ErpFilterValue, ErpSegmentedFilter } from './segmented-filter';
import {
  CYCLE_WEEKS,
  WEEKDAYS,
  customerTypeName,
  documentTypeName,
  erpStatusLabel,
  mapsUrl,
  ubigeoText,
  visitSummaryText,
} from '../request-format';
import {
  ApproveCreationCommand,
  CreationRequestDetail,
  CreationRequestSummary,
} from '../../../shared/models/customer-request.models';
import { dateTimeText } from '../../assignments/assignment-format';

/** Pestaña Creación de la bandeja de Aprobaciones — doc 39, sección 5. */
@Component({
  selector: 'app-creation-tab',
  imports: [
    UiButton,
    UiEmpty,
    UiTypeahead,
    UiApprovalTray,
    UiStatusSteps,
    ErpBadge,
    ErpSegmentedFilter,
  ],
  templateUrl: './creation-tab.html',
  styleUrls: ['./creation-tab.scss'],
})
export class CreationTab {
  private store = inject(ApprovalsStore);
  private svc = inject(CustomerRequestAdminService);
  private lookupSvc = inject(LookupService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  selectedKey = input<string | null>(null);
  select = output<string | null>();

  protected String = String;
  protected rows = this.store.creationRows;
  protected documentTypeName = documentTypeName;
  protected customerTypeName = customerTypeName;
  protected ubigeoText = ubigeoText;
  protected mapsUrl = mapsUrl;
  protected dateTimeText = dateTimeText;
  protected erpStatusLabel = erpStatusLabel;
  protected weekdays = WEEKDAYS;
  protected cycleWeeks = CYCLE_WEEKS;

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

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

  protected detail = signal<CreationRequestDetail | null>(null);
  protected detailLoading = signal(false);
  protected detailError = signal(false);

  protected vendor = signal<UiLookupItem | null>(null);
  protected weekdaysValue = signal<number[]>([]);
  protected weeksValue = signal<number[]>([]);
  protected acting = signal(false);
  protected actionError = signal('');

  protected visitSummary = computed(() =>
    visitSummaryText(this.weekdaysValue(), this.weeksValue()),
  );

  protected steps = computed<UiStatusStep[]>(() => {
    const d = this.detail();
    if (!d) return [];
    return [
      { label: 'Solicitada', state: 'complete', meta: dateTimeText(d.createdAt) },
      {
        label: 'Registrada en el ERP',
        state: d.erpRegistered ? 'complete' : 'current',
        meta: d.erpRegistered ? dateTimeText(d.erpRegisteredAt) : '',
      },
      { label: 'Aprobada', state: 'upcoming' },
    ];
  });

  protected approveReason = computed(() => {
    const d = this.detail();
    if (!d) return '';
    if (!d.erpRegistered) return 'Disponible cuando el ERP registre al cliente.';
    if (this.weekdaysValue().length === 0) return 'Elige al menos un día de visita.';
    if (this.weeksValue().length === 0) return 'Elige al menos una semana del ciclo.';
    return '';
  });
  protected canApprove = computed(() => !this.acting() && this.approveReason() === '');

  private retryTick = signal(0);
  private requestKey = computed(() => {
    const k = this.selectedKey();
    return k ? { id: Number(k), attempt: this.retryTick() } : null;
  });

  constructor() {
    toObservable(this.requestKey)
      .pipe(
        tap(() => {
          this.detail.set(null);
          this.detailError.set(false);
        }),
        switchMap((req) => {
          if (!req) return of(null);
          this.detailLoading.set(true);
          return this.svc.creationDetail(req.id).pipe(
            catchError(() => {
              this.detailError.set(true);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((d) => {
        this.detailLoading.set(false);
        if (d) {
          this.detail.set(d);
          this.vendor.set({ id: d.requestedBy, name: d.requestedByName });
          this.weekdaysValue.set([]);
          this.weeksValue.set([]);
          this.actionError.set('');
        }
      });

    // Al terminar un refresco (inicial o cada 60s): reselecciona si la fila
    // abierta desapareció y refresca su detalle sin pisar lo que el
    // supervisor ya eligió (sección 4.6).
    effect(() => {
      const loading = this.store.loading();
      untracked(() => {
        if (loading) return;
        const stillValid = this.ensureSelection(this.rows());
        if (stillValid) this.silentRefreshDetail();
      });
    });
  }

  private ensureSelection(rows: CreationRequestSummary[]): boolean {
    const current = this.selectedKey();
    if (rows.length === 0) {
      if (current !== null) this.select.emit(null);
      return false;
    }
    const exists = current !== null && rows.some((r) => String(r.requestId) === current);
    if (!exists) {
      if (current !== null) this.toast.info('Esta solicitud ya fue resuelta por otro usuario.');
      this.select.emit(String(rows[0].requestId));
      return false;
    }
    return true;
  }

  private silentRefreshDetail() {
    const req = this.requestKey();
    if (!req || !this.detail()) return;
    this.svc.creationDetail(req.id).subscribe({
      next: (d) => this.detail.set(d),
      error: () => {
        /* se mantiene el último detalle bueno conocido */
      },
    });
  }

  protected pick(requestId: number) {
    this.select.emit(String(requestId));
  }

  protected retryDetail() {
    this.retryTick.update((n) => n + 1);
  }

  protected toggleWeekday(value: number) {
    this.weekdaysValue.update((cur) =>
      cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value].sort((a, b) => a - b),
    );
  }

  protected toggleWeek(value: number) {
    this.weeksValue.update((cur) =>
      cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value].sort((a, b) => a - b),
    );
  }

  protected approve() {
    const d = this.detail();
    if (!d || !this.canApprove()) return;
    const vendorName = this.vendor()?.name || d.requestedByName;
    this.dialog
      .confirm({
        title: 'Aprobar y crear cliente',
        message: `¿Crear al cliente ${d.businessName} con el código ${d.customerCode}, asignado a ${vendorName}? ${this.visitSummary()}`,
        confirmLabel: 'Aprobar y crear',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.acting.set(true);
        this.actionError.set('');
        const cmd: ApproveCreationCommand = {
          userId: this.vendor()?.id !== d.requestedBy ? (this.vendor()?.id ?? null) : null,
          weekdays: this.weekdaysValue(),
          weeksOfCycle: this.weeksValue(),
        };
        this.svc.approveCreation(d.requestId, cmd).subscribe({
          next: (result) => {
            this.acting.set(false);
            this.toast.success(`Cliente creado con el código ${d.customerCode}.`, {
              label: 'Ver ficha',
              onClick: () => this.router.navigate(['/clientes', result.customerId]),
            });
            this.store.loadAll();
          },
          error: (err) => {
            this.acting.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.actionError.set(detalle || 'No pudimos aprobar la solicitud.');
            if (detalle?.includes('ya fue resuelta')) this.store.loadAll();
          },
        });
      });
  }

  protected reject() {
    const d = this.detail();
    if (!d) return;
    this.dialog
      .confirm({
        title: 'Rechazar solicitud',
        message: `¿Rechazar la solicitud de ${d.businessName}? No se creará el cliente.`,
        confirmLabel: 'Rechazar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.acting.set(true);
        this.actionError.set('');
        this.svc.rejectCreation(d.requestId).subscribe({
          next: () => {
            this.acting.set(false);
            this.store.loadAll();
          },
          error: (err) => {
            this.acting.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.actionError.set(detalle || 'No pudimos rechazar la solicitud.');
            if (detalle?.includes('ya fue resuelta')) this.store.loadAll();
          },
        });
      });
  }
}
