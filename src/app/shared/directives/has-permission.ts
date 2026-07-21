import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from '../../core/auth/auth';

@Directive({ selector: '[hasPermission]' })
export class HasPermissionDirective {
  private tpl = inject<TemplateRef<unknown>>(TemplateRef);
  private vc = inject(ViewContainerRef);
  private auth = inject(AuthService);

  readonly hasPermission = input.required<string | string[]>();

  constructor() {
    let shown = false;
    effect(() => {
      const perms = this.hasPermission();
      const list = Array.isArray(perms) ? perms : [perms];
      const allowed = this.auth.hasAny(...list);
      if (allowed && !shown) {
        this.vc.createEmbeddedView(this.tpl);
        shown = true;
      } else if (!allowed && shown) {
        this.vc.clear();
        shown = false;
      }
    });
  }
}
