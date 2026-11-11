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
import { fieldChangeErpStatusLabel, fieldNameLabel, mapsUrl } from '../request-format';
import { FieldChangeGroupView } from '../../../shared/models/customer-request.models';
import { dateTimeText } from '../../assignments/assignment-format';

/** Pestaña Cambio de campo de la bandeja de Aprobaciones — doc 39, sección 6. */
@Component({
  selector: 'app-field-change-tab',
  imports: [
    UiButton,
    UiEmpty,
    RouterLink,
    UiApprovalTray,
    UiStatusSteps,
    ErpBadge,
    ErpSegmentedFilter,
  ],
  templateUrl: './field-change-tab.html',
  styleUrls: ['./field-change-tab.scss'],
})
export class FieldChangeTab {
  private store = inject(ApprovalsStore);
  private svc = inject(CustomerRequestAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  selectedKey = input<string | null>(null);
  select = output<string | null>();

  protected groups = this.store.fieldChangeGroups;
  protected dateTimeText = dateTimeText;
  protected fieldNameLabel = fieldNameLabel;
  protected mapsUrl = mapsUrl;

  protected filterValue = signal<ErpFilterValue>('all');
  protected filterCounts = computed<ErpFilterCounts>(() => {
    const groups = this.groups();
    return {
      all: groups.length,
      ready: groups.filter((g) => g.erpRegistered).length,
      waiting: groups.filter((g) => !g.erpRegistered).length,
    };
  });
  protected filteredGroups = computed(() => {
    const groups = this.groups();
    const f = this.filterValue();
    if (f === 'ready') return groups.filter((g) => g.erpRegistered);
    if (f === 'waiting') return groups.filter((g) => !g.erpRegistered);
    return groups;
  });

  protected rowErpLabel(g: FieldChangeGroupView) {
    return fieldChangeErpStatusLabel(g.erpRegisteredCount, g.changes.length);
  }

  /** "2 campos: Teléfono, Dirección" — doc 39, sección 6.3, recortado con "…". */
  protected changedFieldsSummary(g: FieldChangeGroupView): string {
    const labels = g.changes.map((c) => fieldNameLabel(c.fieldName)).join(', ');
    const count = g.changes.length === 1 ? '1 campo' : `${g.changes.length} campos`;
    const text = `${count}: ${labels}`;
    return text.length > 48 ? `${text.slice(0, 48)}…` : text;
  }

  protected selected = computed<FieldChangeGroupView | null>(() => {
    const key = this.selectedKey();
    if (!key) return null;
    return this.groups().find((g) => g.groupId === key) ?? null;
  });

  protected steps = computed<UiStatusStep[]>(() => {
    const g = this.selected();
    if (!g) return [];
    const total = g.changes.length;
    return [
      { label: 'Solicitada', state: 'complete', meta: dateTimeText(g.createdAt) },
      {
        label: 'Registrada en el ERP',
        state: g.erpRegistered ? 'complete' : 'current',
        meta: g.erpRegistered
          ? ''
          : g.erpRegisteredCount > 0
            ? `${g.erpRegisteredCount} de ${total} campos`
            : '',
      },
      { label: 'Aprobada', state: 'upcoming' },
    ];
  });

  /** Fila combinada cuando el grupo trae latitud y longitud juntas — doc 39, sección 3.3. */
  protected gpsChange(
    g: FieldChangeGroupView,
  ): { beforeUrl: string | null; afterUrl: string } | null {
    const lat = g.changes.find((c) => c.fieldName === 'LATITUDE');
    const lng = g.changes.find((c) => c.fieldName === 'LONGITUDE');
    if (!lat || !lng) return null;
    const beforeUrl =
      lat.previousValue && lng.previousValue
        ? mapsUrl(Number(lat.previousValue), Number(lng.previousValue))
        : null;
    return { beforeUrl, afterUrl: mapsUrl(Number(lat.newValue), Number(lng.newValue)) };
  }

  protected acting = signal(false);
  protected actionError = signal('');
  protected actionErrorCustomerId = signal<number | null>(null);
  /** Confirmación pendiente (abierta pero no respondida) — doc 75, sección 2: evita abrir dos a la vez con un clic doble. */
  protected dialogOpen = signal(false);

  constructor() {
    effect(() => {
      const loading = this.store.loading();
      untracked(() => {
        if (loading) return;
        this.ensureSelection(this.groups());
      });
    });
  }

  private ensureSelection(groups: FieldChangeGroupView[]) {
    const current = this.selectedKey();
    if (groups.length === 0) {
      if (current !== null) this.select.emit(null);
      return;
    }
    const exists = current !== null && groups.some((g) => g.groupId === current);
    if (!exists) {
      // Doc 75, sección 3.1: no se inventa un motivo — la fila ya no está y
      // se pasa a la siguiente en silencio; si hubo un error, lo cuenta el backend.
      this.select.emit(groups[0].groupId);
    }
  }

  protected pick(groupId: string) {
    this.select.emit(groupId);
  }

  protected rejectDisabled(g: FieldChangeGroupView): boolean {
    return g.erpRegisteredCount > 0;
  }

  protected approve(g: FieldChangeGroupView) {
    if (this.acting() || this.dialogOpen()) return;
    const lines = g.changes
      .map(
        (c) =>
          `${fieldNameLabel(c.fieldName)}: ${c.previousValue ?? 'sin registro'} → ${c.newValue}`,
      )
      .join(' · ');
    const pending = g.changes.length - g.erpRegisteredCount;
    const erpWarning = g.erpRegistered
      ? ''
      : ` El ERP aún no registra ${pending} de ${g.changes.length} cambios. Al aprobar, se aplican en el app; corrígelos también en el ERP.`;
    this.dialogOpen.set(true);
    this.dialog
      .confirm({
        title: 'Aprobar cambios',
        message: `¿Aplicar ${g.changes.length} cambios a ${g.businessName}? ${lines}${erpWarning}`,
        confirmLabel: 'Aprobar cambios',
      })
      .subscribe((confirmed) => {
        this.dialogOpen.set(false);
        if (!confirmed || this.acting()) return;
        this.acting.set(true);
        this.actionError.set('');
        this.actionErrorCustomerId.set(null);
        this.svc.approveFieldChange(g.groupId).subscribe({
          next: () => {
            this.acting.set(false);
            const corrige = g.erpRegistered ? '' : ' Corrígelos también en el ERP.';
            this.toast.success(`Cambios aplicados a ${g.businessName}.${corrige}`);
            this.store.loadAll();
          },
          error: (err) => {
            this.acting.set(false);
            const detalle: string = err?.error?.detail ?? err?.error?.message ?? '';
            this.actionError.set(detalle || 'No pudimos aprobar los cambios.');
            this.actionErrorCustomerId.set(detalle.includes('inactivo') ? g.customerId : null);
            if (detalle.includes('ya fue resuelta')) this.store.loadAll();
          },
        });
      });
  }

  protected reject(g: FieldChangeGroupView) {
    if (this.rejectDisabled(g) || this.acting() || this.dialogOpen()) return;
    this.dialogOpen.set(true);
    this.dialog
      .confirm({
        title: 'Rechazar cambios',
        message: `¿Rechazar los cambios de ${g.businessName}? El cliente queda con sus datos actuales.`,
        confirmLabel: 'Rechazar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        this.dialogOpen.set(false);
        if (!confirmed || this.acting()) return;
        this.acting.set(true);
        this.actionError.set('');
        this.actionErrorCustomerId.set(null);
        this.svc.rejectFieldChange(g.groupId).subscribe({
          next: () => {
            this.acting.set(false);
            this.toast.success(
              `Cambios de ${g.businessName} rechazados: el cliente queda con sus datos actuales.`,
            );
            this.store.loadAll();
          },
          error: (err) => {
            this.acting.set(false);
            const detalle = err?.error?.detail ?? err?.error?.message;
            this.actionError.set(detalle || 'No pudimos rechazar los cambios.');
            if (detalle?.includes('ya fue resuelta')) this.store.loadAll();
          },
        });
      });
  }
}
