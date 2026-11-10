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
import { UiField } from '../../../shared/ui/field/field';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UiApprovalTray } from '../../../shared/ui/approval-tray/approval-tray';
import { UiStatusSteps, UiStatusStep } from '../../../shared/ui/status-steps/status-steps';
import { VendorVisits } from '../../../shared/ui/vendor-visits/vendor-visits';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { LookupService, toUiLookup } from '../../promos/lookup';
import { ApprovalsStore } from '../approvals-store';
import { CustomerRequestAdminService } from '../customer-request-admin';
import { ErpBadge } from './erp-badge';
import { ErpFilterCounts, ErpFilterValue, ErpSegmentedFilter } from './segmented-filter';
import {
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
    UiField,
    UiEmpty,
    UiApprovalTray,
    UiStatusSteps,
    VendorVisits,
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

  // — Código y secuencia cuando el ERP todavía no registró la solicitud — doc 74, sección 3.1 —
  protected customerCode = signal('');
  protected routeSequence = signal('');
  protected codeFieldError = signal('');
  protected sequenceFieldError = signal('');

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

  private routeSequenceValid = computed(() => {
    const v = this.routeSequence().trim();
    return v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;
  });

  protected approveReason = computed(() => {
    const d = this.detail();
    if (!d) return '';
    if (!d.erpRegistered) {
      if (!this.customerCode().trim()) return 'Escribe el código del cliente.';
      if (!this.routeSequenceValid()) return 'Escribe la secuencia de ruta.';
    }
    if (this.weekdaysValue().length === 0) return 'Elige al menos un día de visita.';
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
          // Marcadas con las 4 por defecto — doc 68, sección 7.3.
          this.weeksValue.set([1, 2, 3, 4]);
          this.customerCode.set('');
          this.routeSequence.set('');
          this.codeFieldError.set('');
          this.sequenceFieldError.set('');
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
      next: (d) => {
        const prev = this.detail();
        // Doc 74, sección 3.1: si mientras tanto el ERP la registró, se
        // reemplazan los campos propios por los del ERP y se avisa.
        if (prev && !prev.erpRegistered && d.erpRegistered) {
          this.toast.info(
            `El ERP acaba de registrar esta solicitud con el código ${d.customerCode}.`,
          );
          this.customerCode.set('');
          this.routeSequence.set('');
          this.codeFieldError.set('');
          this.sequenceFieldError.set('');
        }
        this.detail.set(d);
      },
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

  protected onCustomerCodeChange(v: string) {
    this.customerCode.set(v.slice(0, 10));
    this.codeFieldError.set('');
  }

  protected onRouteSequenceChange(v: string) {
    this.routeSequence.set(v);
    this.sequenceFieldError.set('');
  }

  protected approve() {
    const d = this.detail();
    if (!d || !this.canApprove()) return;
    const vendorName = this.vendor()?.name || d.requestedByName;
    const message = d.erpRegistered
      ? `¿Crear al cliente ${d.businessName} con el código ${d.customerCode}, asignado a ${vendorName}? ${this.visitSummary()}`
      : `¿Crear al cliente ${d.businessName}, asignado a ${vendorName}? ${this.visitSummary()} Se creará con el código ${this.customerCode().trim()} y la secuencia ${this.routeSequence().trim()}. Deben coincidir con el ERP.`;
    this.dialog
      .confirm({ title: 'Aprobar y crear cliente', message, confirmLabel: 'Aprobar y crear' })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.acting.set(true);
        this.actionError.set('');
        const cmd: ApproveCreationCommand = {
          userId: this.vendor()?.id !== d.requestedBy ? (this.vendor()?.id ?? null) : null,
          weekdays: this.weekdaysValue(),
          weeksOfCycle: this.weeksValue().length > 0 ? this.weeksValue() : null,
          customerCode: d.erpRegistered ? null : this.customerCode().trim(),
          routeSequence: d.erpRegistered ? null : Number(this.routeSequence()),
        };
        const createdCode = d.erpRegistered ? d.customerCode : this.customerCode().trim();
        this.svc.approveCreation(d.requestId, cmd).subscribe({
          next: (result) => {
            this.acting.set(false);
            this.toast.success(`Cliente creado con el código ${createdCode}.`, {
              label: 'Ver ficha',
              onClick: () => this.router.navigate(['/clientes', result.customerId]),
            });
            this.store.loadAll();
          },
          error: (err) => {
            this.acting.set(false);
            const detalle: string = err?.error?.detail ?? err?.error?.message ?? '';
            if (detalle.includes('ya fue resuelta')) {
              this.actionError.set(detalle);
              this.store.loadAll();
              return;
            }
            const lower = detalle.toLowerCase();
            if (lower.includes('ya registró esta solicitud con el código')) {
              // Doc 74, sección 5.2: el ERP se adelantó — se recarga el detalle.
              this.actionError.set(detalle);
              this.silentRefreshDetail();
              return;
            }
            if (lower.includes('secuencia de ruta')) {
              this.sequenceFieldError.set(detalle);
              return;
            }
            if (lower.includes('código')) {
              this.codeFieldError.set(detalle);
              return;
            }
            this.actionError.set(detalle || 'No pudimos aprobar la solicitud.');
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
