import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../../shared/ui/field/field';
import { UiCheckbox } from '../../../../shared/ui/checkbox/checkbox';
import { UiTypeahead, UiLookupItem } from '../../../../shared/ui/typeahead/typeahead';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiInfoTip } from '../../../../shared/ui/info-tip/info-tip';
import { UiDialogService } from '../../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../../core/ui/toast';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { AuthService } from '../../../../core/auth/auth';
import { GoodsReceiptsApi } from '../../data-access/goods-receipts.api';
import { CatalogLookupService } from '../../../catalog/catalog-lookup';
import {
  BrandProductView,
  DocumentTypeCode,
  ReceiptDetail,
  ReceiptIssueView,
  ReceiptLineInput,
  ReceiptUnitType,
  UpdateReceiptCommand,
} from '../../domain/goods-receipt.models';
import { WarehouseView } from '../../../../shared/models/inventory.models';
import {
  BADGE_TONE_VAR,
  DOCUMENT_TYPE_OPTIONS,
  IssueField,
  SEVERITY_TONE,
  STATUS_TONE,
  UNIT_TYPE_OPTIONS,
  issueField,
  lineOrigin,
  quantityInUnitsText,
  unitCostText,
} from '../../domain/goods-receipt.format';
import { dateTimeText } from '../../../assignments/assignment-format';
import { formatSoles } from '../../../../shared/pipes/money';

let lineKeySeq = 0;

interface LineDraft {
  key: number;
  lineNumber: number | null;
  productCode: string | null;
  productName: string | null;
  unitsPerPackage: number | null;
  supplierCode: string;
  supplierDescription: string;
  quantity: string;
  unitCost: string;
  subtotal: string;
  bonus: boolean;
  aiRead: boolean;
  edited: boolean;
  purchaseUnitCost: number | null;
  purchasePackageCost: number | null;
}

function toDraft(l: ReceiptDetail['lines'][number]): LineDraft {
  return {
    key: lineKeySeq++,
    lineNumber: l.lineNumber,
    productCode: l.productCode,
    productName: l.productName,
    unitsPerPackage: l.unitsPerPackage,
    supplierCode: l.supplierCode ?? '',
    supplierDescription: l.supplierDescription ?? '',
    quantity: l.quantity != null ? String(l.quantity) : '',
    unitCost: l.unitCost != null ? String(l.unitCost) : '',
    subtotal: l.subtotal != null ? String(l.subtotal) : '',
    bonus: l.bonus,
    aiRead: l.aiRead,
    edited: l.edited,
    purchaseUnitCost: l.purchaseUnitCost,
    purchasePackageCost: l.purchasePackageCost,
  };
}

function emptyDraft(): LineDraft {
  return {
    key: lineKeySeq++,
    lineNumber: null,
    productCode: null,
    productName: null,
    unitsPerPackage: null,
    supplierCode: '',
    supplierDescription: '',
    quantity: '',
    unitCost: '',
    subtotal: '',
    bonus: false,
    aiRead: false,
    edited: false,
    purchaseUnitCost: null,
    purchasePackageCost: null,
  };
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Entrega N.° {receiptId} — doc 58, sección 7. Página propia (no panel
 * lateral): la tabla de líneas necesita todo el ancho. Editable solo en
 * revisión y con permiso de edición; confirmada/anulada queda de solo
 * lectura. Todo lo calcula el servidor: el panel solo arma el envío y
 * muestra lo que vuelve.
 */
@Component({
  selector: 'app-receipt-detail',
  imports: [
    UiButton,
    UiField,
    UiCheckbox,
    UiTypeahead,
    UiEmpty,
    UiInfoTip,
  ],
  templateUrl: './receipt-detail.html',
  styleUrl: './receipt-detail.scss',
})
export class ReceiptDetailPage {
  private api = inject(GoodsReceiptsApi);
  private catalogSvc = inject(CatalogLookupService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private auth = inject(AuthService);

  receiptId = input.required<string>();

  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;
  protected unitCostText = unitCostText;
  protected quantityInUnitsText = quantityInUnitsText;
  protected documentTypeOptions = DOCUMENT_TYPE_OPTIONS;
  protected unitTypeOptions = UNIT_TYPE_OPTIONS;
  protected permissions = PERMISSIONS;
  protected lineOrigin = lineOrigin;

  protected canEditPermission = computed(() =>
    this.auth.hasAny(PERMISSIONS.GOODS_RECEIPT_MANAGE, PERMISSIONS.GOODS_RECEIPT_STORE),
  );

  protected detail = signal<ReceiptDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected notFound = signal(false);

  protected warehouses = signal<WarehouseView[]>([]);
  protected brandProducts = signal<BrandProductView[]>([]);
  protected contextError = signal('');

  // — Borrador de cabecera —
  protected supplierName = signal('');
  protected ruc = signal('');
  protected documentTypeCode = signal<DocumentTypeCode | ''>('');
  protected documentNumber = signal('');
  protected warehouseId = signal('');
  protected unitType = signal<ReceiptUnitType>('UNIT');
  protected pricesIncludeTax = signal(false);
  protected totalAmount = signal('');
  protected taxAmount = signal('');
  protected lines = signal<LineDraft[]>([]);

  protected dirty = signal(false);
  protected saving = signal(false);
  protected confirming = signal(false);
  protected cancelling = signal(false);

  protected fieldErrors = signal<Record<string, string>>({});

  protected canEdit = computed(
    () => this.detail()?.statusCode === 'IN_REVIEW' && this.canEditPermission(),
  );

  protected issues = computed(() => this.detail()?.issues ?? []);
  protected blockingCount = computed(
    () => this.issues().filter((i) => i.severity === 'BLOCKING').length,
  );
  protected warningCount = computed(
    () => this.issues().filter((i) => i.severity === 'WARNING').length,
  );

  protected warehouseOptions = computed<UiFieldOption[]>(() =>
    this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  );

  private productLookup = computed<UiLookupItem[]>(() =>
    this.brandProducts().map((p, i) => ({
      id: i,
      code: p.productCode,
      name: p.productName,
      extraInfo: [
        p.unitOfMeasure,
        p.unitsPerPackage ? `${p.unitsPerPackage} und./paq.` : null,
        p.bonusEligible ? 'Bonificación' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  );

  protected productSearch = (q: string): Observable<UiLookupItem[]> => {
    const needle = q.trim().toLowerCase();
    if (!needle) return of(this.productLookup().slice(0, 30));
    return of(
      this.productLookup().filter(
        (p) => p.code?.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle),
      ),
    );
  };

  private loadEffect = effect(() => {
    const id = this.receiptId();
    untracked(() => {
      if (id) this.load();
    });
  });

  constructor() {
    this.catalogSvc.warehouses().subscribe((list) => this.warehouses.set(list));
  }

  load() {
    const id = Number(this.receiptId());
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this.notFound.set(false);
    this.api.detail(id).subscribe({
      next: (d) => {
        this.applyDetail(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) this.notFound.set(true);
        else this.error.set(true);
      },
    });
  }

  private applyDetail(d: ReceiptDetail) {
    this.detail.set(d);
    this.supplierName.set(d.supplierName ?? '');
    this.ruc.set(d.ruc ?? '');
    this.documentTypeCode.set((d.documentTypeCode as DocumentTypeCode) ?? '');
    this.documentNumber.set(d.documentNumber ?? '');
    this.warehouseId.set(String(d.warehouseId));
    this.unitType.set(d.unitType);
    this.pricesIncludeTax.set(d.pricesIncludeTax);
    this.totalAmount.set(d.totalAmount != null ? String(d.totalAmount) : '');
    this.taxAmount.set(d.taxAmount != null ? String(d.taxAmount) : '');
    this.lines.set(d.lines.map(toDraft));
    this.dirty.set(false);
    this.fieldErrors.set({});
    if (d.statusCode === 'IN_REVIEW') this.loadContext(d.brandId);
  }

  private loadContext(brandId: number) {
    this.contextError.set('');
    this.api.brandContext(brandId).subscribe({
      next: (ctx) => this.brandProducts.set(ctx.products),
      error: (err) => {
        const detalle = err?.error?.detail ?? 'No se pudo cargar el catálogo de productos de la marca.';
        this.contextError.set(detalle);
      },
    });
  }

  protected markDirty() {
    this.dirty.set(true);
  }

  // — Cabecera —
  protected onSupplierName(v: string) {
    this.supplierName.set(v);
    this.markDirty();
  }
  protected onRuc(v: string) {
    this.ruc.set(v.replace(/\D/g, '').slice(0, 11));
    this.markDirty();
  }
  protected onDocumentTypeCode(v: string) {
    this.documentTypeCode.set(v as DocumentTypeCode | '');
    this.markDirty();
  }
  protected onDocumentNumber(v: string) {
    this.documentNumber.set(v);
    this.markDirty();
  }
  protected onWarehouseId(v: string) {
    this.warehouseId.set(v);
    this.markDirty();
  }
  protected onUnitType(v: ReceiptUnitType) {
    this.unitType.set(v);
    this.markDirty();
  }
  protected onPricesIncludeTax(v: boolean) {
    this.pricesIncludeTax.set(v);
    this.markDirty();
  }
  protected onTotalAmount(v: string) {
    this.totalAmount.set(v);
    this.markDirty();
  }
  protected onTaxAmount(v: string) {
    this.taxAmount.set(v);
    this.markDirty();
  }

  protected rucError(): string {
    if (this.fieldErrors()['ruc']) return this.fieldErrors()['ruc'];
    const v = this.ruc();
    return v && v.length !== 11 ? 'El RUC debe tener 11 dígitos' : '';
  }

  // — Líneas —
  protected lineProductSelected(l: LineDraft): UiLookupItem | null {
    if (!l.productCode) return null;
    return { id: -1, code: l.productCode, name: l.productName ?? l.productCode };
  }

  protected setLineProduct(l: LineDraft, item: UiLookupItem) {
    l.productCode = item.code ?? null;
    l.productName = item.name;
    const match = this.brandProducts().find((p) => p.productCode === item.code);
    l.unitsPerPackage = match?.unitsPerPackage ?? null;
    this.lines.update((list) => [...list]);
    this.markDirty();
  }

  protected setLineField(l: LineDraft, field: 'supplierCode' | 'supplierDescription', v: string) {
    l[field] = v;
    this.lines.update((list) => [...list]);
    this.markDirty();
  }

  protected setLineNumberField(l: LineDraft, field: 'quantity' | 'unitCost' | 'subtotal', v: string) {
    l[field] = v;
    this.lines.update((list) => [...list]);
    this.markDirty();
  }

  protected setLineBonus(l: LineDraft, v: boolean) {
    l.bonus = v;
    this.lines.update((list) => [...list]);
    this.markDirty();
  }

  protected quantityInUnits(l: LineDraft): string {
    if (this.unitType() !== 'PACKAGE' || !l.unitsPerPackage) return '';
    const qty = numOrNull(l.quantity);
    if (qty == null) return '';
    return quantityInUnitsText(qty * l.unitsPerPackage);
  }

  protected purchaseCostTooltip(l: LineDraft): string {
    const v = this.unitType() === 'PACKAGE' ? l.purchasePackageCost : l.purchaseUnitCost;
    return `Costo de compra (ERP): ${v != null ? unitCostText(v) : '—'} sin IGV`;
  }

  protected addLine() {
    this.lines.update((list) => [...list, emptyDraft()]);
    this.markDirty();
  }

  protected removeLine(l: LineDraft) {
    this.lines.update((list) => list.filter((x) => x !== l));
    this.markDirty();
  }

  // — Observaciones —
  protected headerIssues = computed(() => this.issues().filter((i) => i.lineNumber == null));
  protected issuesForLine(lineNumber: number | null): ReceiptIssueView[] {
    if (lineNumber == null) return [];
    return this.issues().filter((i) => i.lineNumber === lineNumber);
  }
  protected lineSeverity(l: LineDraft): 'BLOCKING' | 'WARNING' | null {
    const list = this.issuesForLine(l.lineNumber);
    if (list.some((i) => i.severity === 'BLOCKING')) return 'BLOCKING';
    if (list.length > 0) return 'WARNING';
    return null;
  }
  protected cellIssueSeverity(l: LineDraft, field: IssueField): 'BLOCKING' | 'WARNING' | null {
    const matches = this.issuesForLine(l.lineNumber).filter((i) => issueField(i.code) === field);
    if (matches.some((i) => i.severity === 'BLOCKING')) return 'BLOCKING';
    if (matches.length > 0) return 'WARNING';
    return null;
  }
  protected fieldIssueMessage(field: IssueField): string {
    return this.headerIssues().find((i) => issueField(i.code) === field)?.message ?? '';
  }
  protected toneVar(severity: 'BLOCKING' | 'WARNING') {
    return BADGE_TONE_VAR[SEVERITY_TONE[severity]];
  }
  protected statusToneVar() {
    const d = this.detail();
    return d ? BADGE_TONE_VAR[STATUS_TONE[d.statusCode]] : '';
  }
  protected BADGE_TONE_VAR = BADGE_TONE_VAR;
  protected numVal(raw: string): number | null {
    return numOrNull(raw);
  }

  protected focusIssue(issue: ReceiptIssueView) {
    const id = issue.lineNumber != null ? `grd-line-${issue.lineNumber}` : `grd-field-${issueField(issue.code)}`;
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // — Guardar / confirmar / anular —
  private buildCommand(): UpdateReceiptCommand | null {
    const d = this.detail();
    if (!d) return null;
    const lines: ReceiptLineInput[] = this.lines().map((l) => ({
      lineNumber: l.lineNumber,
      productCode: l.productCode,
      supplierCode: l.supplierCode || null,
      supplierDescription: l.supplierDescription || null,
      quantity: numOrNull(l.quantity),
      unitCost: numOrNull(l.unitCost),
      subtotal: numOrNull(l.subtotal),
      bonus: l.bonus,
    }));
    return {
      expectedUpdatedAt: d.updatedAt,
      warehouseId: Number(this.warehouseId()),
      supplierName: this.supplierName() || null,
      ruc: this.ruc() || null,
      documentTypeCode: (this.documentTypeCode() || null) as DocumentTypeCode | null,
      documentNumber: this.documentNumber() || null,
      unitType: this.unitType(),
      pricesIncludeTax: this.pricesIncludeTax(),
      totalAmount: numOrNull(this.totalAmount()),
      taxAmount: numOrNull(this.taxAmount()),
      lines,
    };
  }

  /** Guardar — doc 58, sección 7.4. Devuelve el detalle nuevo por el observable para encadenar con Confirmar. */
  protected save(onSuccess?: (d: ReceiptDetail) => void) {
    const cmd = this.buildCommand();
    const d = this.detail();
    if (!cmd || !d) return;
    this.saving.set(true);
    this.fieldErrors.set({});
    this.api.update(d.receiptId, cmd).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.applyDetail(updated);
        if (updated.canConfirm === false && updated.issues.some((i) => i.severity === 'BLOCKING')) {
          this.toast.success(
            `Cambios guardados. Quedan ${this.blockingCount()} observaciones por corregir`,
          );
        } else {
          this.toast.success('Cambios guardados');
        }
        onSuccess?.(updated);
      },
      error: (err) => this.handleSaveError(err),
    });
  }

  private handleSaveError(err: {
    status?: number;
    error?: { detail?: string; errors?: Record<string, string> };
  }) {
    this.saving.set(false);
    const detalle = err?.error?.detail ?? '';
    if (err?.status === 409 && detalle.startsWith('Otro usuario modificó')) {
      this.openConflictDialog(detalle);
      return;
    }
    if (err?.status === 409) {
      this.toast.error(detalle || 'No pudimos guardar los cambios.');
      this.load();
      return;
    }
    if (err?.status === 400 && err.error?.errors) {
      this.fieldErrors.set(err.error.errors);
      this.toast.error(err.error.detail || 'Revisa los campos marcados.');
      return;
    }
    this.toast.error(detalle || 'No se pudo completar la operación. Inténtalo de nuevo.');
  }

  private openConflictDialog(message: string) {
    this.dialog
      .confirm({
        title: 'Edición simultánea',
        message:
          'Otro usuario modificó esta entrega mientras la revisaba. Vuelva a cargarla para ver los cambios.',
        confirmLabel: 'Recargar',
        cancelLabel: 'Seguir editando',
      })
      .subscribe((confirmed) => {
        if (confirmed) this.load();
      });
    void message;
  }

  protected confirmReceipt() {
    const d = this.detail();
    if (!d) return;
    const run = () => {
      this.dialog
        .confirm({
          title: 'Confirmar entrega',
          message: `¿Confirmar la entrega ${d.documentTypeName ?? ''} ${d.documentNumber ?? ''}? Quedará lista para el ERP y ya no se podrá modificar.`,
          confirmLabel: 'Confirmar',
        })
        .subscribe((confirmed) => {
          if (confirmed) this.doConfirm(d.receiptId);
        });
    };
    if (this.dirty()) {
      this.save((updated) => {
        if (updated.canConfirm) run();
      });
    } else {
      run();
    }
  }

  private doConfirm(receiptId: number) {
    this.confirming.set(true);
    this.api.confirm(receiptId).subscribe({
      next: (updated) => {
        this.confirming.set(false);
        this.applyDetail(updated);
        this.toast.success('Entrega confirmada');
      },
      error: (err) => {
        this.confirming.set(false);
        if (err?.status === 409 && err.error?.issues) {
          this.detail.update((d) => (d ? { ...d, issues: err.error.issues } : d));
          this.toast.error('No se puede confirmar: hay observaciones por corregir');
          return;
        }
        if (err?.status === 409) {
          this.toast.error(err?.error?.detail || 'No se pudo confirmar.');
          this.load();
          return;
        }
        this.toast.error(err?.error?.detail || 'No se pudo completar la operación. Inténtalo de nuevo.');
      },
    });
  }

  protected cancelReceipt() {
    const d = this.detail();
    if (!d) return;
    this.dialog
      .confirm({
        title: 'Anular entrega',
        message:
          '¿Anular esta entrega? No se podrá recuperar. El documento se podrá volver a cargar desde la app.',
        confirmLabel: 'Anular',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.cancelling.set(true);
        this.api.cancel(d.receiptId).subscribe({
          next: (updated) => {
            this.cancelling.set(false);
            this.applyDetail(updated);
            this.toast.success('Entrega anulada');
          },
          error: (err) => {
            this.cancelling.set(false);
            this.toast.error(err?.error?.detail || 'No se pudo completar la operación. Inténtalo de nuevo.');
          },
        });
      });
  }

  protected goBack() {
    if (!this.dirty()) {
      this.router.navigate(['/recepcion-mercaderia/entregas']);
      return;
    }
    this.dialog
      .confirm({
        title: 'Salir sin guardar',
        message: 'Hay cambios sin guardar. ¿Salir sin guardar?',
        confirmLabel: 'Salir sin guardar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.router.navigate(['/recepcion-mercaderia/entregas']);
      });
  }
}
