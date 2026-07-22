import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ToastService } from '../../core/ui/toast';
import { TenantService } from './tenant';
import { ConfigView } from '../../shared/models/tenant.models';

interface ConfigGroup {
  group: string;
  items: ConfigView[];
}

@Component({
  selector: 'app-config',
  imports: [MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCheckboxModule],
  template: `
    @for (g of groups(); track g.group) {
      <mat-card class="card">
        <h3>{{ g.group }}</h3>
        @for (c of g.items; track c.configId) {
          <div class="cfg">
            <div class="meta">
              <strong>{{ c.code }}</strong>
              <span class="muted small">{{ c.description }}</span>
            </div>
            <div class="edit">
              @switch (c.configType) {
                @case ('BOOLEAN') {
                  <mat-checkbox
                    [checked]="c.value === 'true'"
                    (change)="setValue(c.configId, $any($event).checked ? 'true' : 'false')"
                  >
                    {{ c.value === 'true' ? 'Sí' : 'No' }}
                  </mat-checkbox>
                }
                @case ('NUMBER') {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <input
                      matInput
                      type="number"
                      [value]="c.value"
                      (input)="setValue(c.configId, $any($event.target).value)"
                    />
                  </mat-form-field>
                }
                @default {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
                    <input
                      matInput
                      [value]="c.value"
                      (input)="setValue(c.configId, $any($event.target).value)"
                    />
                  </mat-form-field>
                }
              }
              <button mat-stroked-button (click)="save(c)">Guardar</button>
            </div>
          </div>
        }
      </mat-card>
    } @empty {
      <p class="muted">No hay parámetros de configuración.</p>
    }
  `,
  styles: [
    `
      .card {
        padding: 20px;
        margin-bottom: 16px;
        max-width: 820px;
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .cfg {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        flex-wrap: wrap;
      }
      .meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .small {
        font-size: 0.8rem;
      }
      .edit {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .grow {
        min-width: 240px;
      }
    `,
  ],
})
export class ConfigPage {
  private tenantSvc = inject(TenantService);
  private toast = inject(ToastService);

  readonly configs = signal<ConfigView[]>([]);

  readonly groups = computed<ConfigGroup[]>(() => {
    const map = new Map<string, ConfigView[]>();
    for (const c of this.configs()) {
      const arr = map.get(c.configGroup) ?? [];
      arr.push(c);
      map.set(c.configGroup, arr);
    }
    return [...map.entries()].map(([group, items]) => ({ group, items }));
  });

  constructor() {
    this.load();
  }

  setValue(configId: number, value: string) {
    this.configs.update((list) => list.map((c) => (c.configId === configId ? { ...c, value } : c)));
  }

  save(c: ConfigView) {
    this.tenantSvc
      .putConfiguration({
        code: c.code,
        configGroup: c.configGroup,
        configType: c.configType,
        value: c.value,
        description: c.description,
      })
      .subscribe({
        next: () => this.toast.success(`${c.code} guardado`),
        error: () => {},
      });
  }

  private load() {
    this.tenantSvc
      .configurations()
      .subscribe({ next: (c) => this.configs.set(c), error: () => this.configs.set([]) });
  }
}
