import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { CoverageDialog } from './ui/coverage-dialog';
import { AssignmentMapAdminService } from './assignment-map-admin';
import { MapOverviewResponse, MapVendorSummary } from '../../shared/models/assignment-map.models';
import {
  headerDateText,
  mapVendorColorVar,
  routeStatusLabel,
  routeTimeRangeText,
} from './map-format';
import { MapOverviewView } from './map/overview-view';
import { MapVendorDayView } from './map/vendor-day-view';
import { MapVendorPortfolioView } from './map/vendor-portfolio-view';
import { MapGlobalView } from './map/global-view';

type ScreenMode = 'overview' | 'vendor-day' | 'vendor-portfolio' | 'global';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Mapa de asignaciones — doc 40. Una pantalla, tres vistas (sección 4):
 * vista general, un vendedor (plan del día o cartera completa) y día
 * global. El estado vive en la URL (`view`/`date`/`vendor`/`mode`) para que
 * F5 y los enlaces lo conserven (ARCHITECTURE_PANEL 8.9 / doc 38 sección 2).
 *
 * El dato de `/map/overview` se pide una sola vez acá (no en cada vista):
 * lo necesitan la vista general, el selector de vendedor de "un vendedor"
 * y el ranking de "día global" (sección 15). Solo se refresca cada 2 min
 * mientras se está viendo la vista general (sección 4.4); cambiar de
 * vendedor o ver el día global no dispara otro refresco de este dato.
 */
@Component({
  selector: 'app-assignment-map',
  imports: [
    UiButton,
    UiField,
    AssignmentModuleTabs,
    MapOverviewView,
    MapVendorDayView,
    MapVendorPortfolioView,
    MapGlobalView,
  ],
  templateUrl: './assignment-map.html',
  styleUrls: ['./assignment-map.scss'],
})
export class AssignmentMapPage {
  private mapSvc = inject(AssignmentMapAdminService);
  private router = inject(Router);
  private dialog = inject(UiDialogService);

  // Ligados a los query params de la ruta (withComponentInputBinding).
  viewParam = input('', { alias: 'view' });
  dateParam = input('', { alias: 'date' });
  vendorParam = input('', { alias: 'vendor' });
  modeParam = input('', { alias: 'mode' });

  protected mapVendorColorVar = mapVendorColorVar;
  protected routeStatusLabel = routeStatusLabel;
  protected routeTimeRangeText = routeTimeRangeText;

  protected selectedDate = computed(() => this.dateParam() || todayIso());
  protected isToday = computed(() => this.selectedDate() === todayIso());

  protected screenMode = computed<ScreenMode>(() => {
    if (this.viewParam() === 'global') return 'global';
    if (!this.vendorParam()) return 'overview';
    return this.modeParam() === 'portfolio' ? 'vendor-portfolio' : 'vendor-day';
  });

  protected selectedVendorId = computed(() => Number(this.vendorParam()) || null);

  protected vendorFromDirectory = computed<MapVendorSummary | null>(() => {
    const id = this.selectedVendorId();
    if (!id) return null;
    return this.overview()?.vendors.find((v) => v.userId === id) ?? null;
  });

  protected overview = signal<MapOverviewResponse | null>(null);
  protected overviewLoading = signal(true);
  protected overviewError = signal(false);
  protected overviewUpdatedAt = signal<Date | null>(null);

  protected vendorDirectory = computed(() => this.overview()?.vendors ?? []);
  protected vendorPickerOpen = signal(false);

  private retryTick = signal(0);

  constructor() {
    toObservable(computed(() => ({ date: this.selectedDate(), attempt: this.retryTick() })))
      .pipe(
        tap(() => {
          this.overviewLoading.set(true);
          this.overviewError.set(false);
        }),
        switchMap((req) =>
          this.mapSvc.overview(req.date).pipe(
            catchError(() => {
              this.overviewError.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.overviewLoading.set(false);
        if (res) {
          this.overview.set(res);
          this.overviewUpdatedAt.set(new Date());
        }
      });

    // Refresco automático cada 2 min: solo en la vista general, hoy, con la
    // ventana visible (sección 4.4).
    const intervalId = setInterval(() => {
      if (
        this.screenMode() === 'overview' &&
        this.isToday() &&
        document.visibilityState === 'visible'
      ) {
        this.refresh();
      }
    }, 120_000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
  }

  protected updatedLabel(): string {
    const d = this.overviewUpdatedAt();
    if (!d) return '—';
    const time = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    return this.isToday() ? `${time} · se actualiza cada 2 min` : time;
  }

  protected headerDateLabel(): string {
    const o = this.overview();
    if (!o) return '';
    return headerDateText(o.weekday, o.weekOfCycle, o.date);
  }

  protected refresh() {
    this.retryTick.update((n) => n + 1);
  }

  protected setDate(offsetDays: number) {
    this.updateUrl({ date: offsetDays === 0 ? null : addDays(todayIso(), offsetDays) });
  }

  protected onDatePicked(value: string) {
    this.updateUrl({ date: value === todayIso() ? null : value });
  }

  protected switchToOverview() {
    this.vendorPickerOpen.set(false);
    this.updateUrl({ view: null, vendor: null, mode: null });
  }

  protected switchToGlobal() {
    this.updateUrl({ view: 'global', vendor: null, mode: null });
  }

  protected goToVendor(userId: number) {
    this.vendorPickerOpen.set(false);
    this.updateUrl({ view: null, vendor: String(userId), mode: null });
  }

  protected setVendorMode(mode: 'day' | 'portfolio') {
    this.updateUrl({ mode: mode === 'day' ? null : mode });
  }

  protected openCoverage() {
    const vendor = this.vendorFromDirectory();
    if (!vendor) return;
    this.dialog
      .open(CoverageDialog, {
        data: {
          absentUserId: vendor.userId,
          absentUserName: vendor.userName,
          defaultDate: this.selectedDate(),
        },
        width: '560px',
      })
      .afterClosed()
      .subscribe((done) => done && this.refresh());
  }

  private updateUrl(params: Record<string, string | null>) {
    this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }
}
