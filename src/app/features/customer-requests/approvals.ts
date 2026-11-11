import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { ApprovalsStore } from './approvals-store';
import { CreationTab } from './ui/creation-tab';
import { FieldChangeTab } from './ui/field-change-tab';
import { ClosureTab } from './ui/closure-tab';

export type ApprovalTab = 'creation' | 'field-change' | 'closure';

/**
 * Aprobaciones de clientes — doc 39, sección 4. Reemplaza las tres pantallas
 * sueltas (creación, cambio de campo, cierre), cada una con su propio
 * diseño, por una sola página con tres pestañas que comparten el mismo
 * patrón de bandeja (listado + detalle + pie fijo). La pestaña activa y la
 * solicitud abierta viven en la URL (`?tab=&id=`) para sobrevivir un F5.
 */
@Component({
  selector: 'app-approvals',
  imports: [UiButton, UiEmpty, CreationTab, FieldChangeTab, ClosureTab],
  templateUrl: './approvals.html',
  styleUrls: ['./approvals.scss'],
})
export class ApprovalsPage {
  protected store = inject(ApprovalsStore);
  private router = inject(Router);

  tabParam = input('', { alias: 'tab' });
  idParam = input('', { alias: 'id' });

  protected activeTab = signal<ApprovalTab>('creation');
  protected selectedKey = signal<string | null>(null);

  constructor() {
    const initialTab = this.tabParam();
    if (initialTab === 'field-change' || initialTab === 'closure') {
      this.activeTab.set(initialTab);
    }
    this.selectedKey.set(this.idParam() || null);

    this.store.loadAll();
    this.store.startAutoRefresh(inject(DestroyRef));
  }

  protected switchTab(tab: ApprovalTab) {
    if (tab === this.activeTab()) return;
    this.activeTab.set(tab);
    this.selectedKey.set(null);
    this.updateUrl(tab, null);
  }

  /** Lo llama cada pestaña al elegir una fila o al perderla (otro supervisor la resolvió). */
  protected onSelect(key: string | null) {
    this.selectedKey.set(key);
    this.updateUrl(this.activeTab(), key);
  }

  protected refresh() {
    this.store.loadAll();
  }

  protected updatedLabel(): string {
    const d = this.store.lastUpdated();
    if (!d) return '—';
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  private updateUrl(tab: ApprovalTab, id: string | null) {
    this.router.navigate([], {
      queryParams: { tab, id: id || null },
      queryParamsHandling: 'merge',
    });
  }
}
