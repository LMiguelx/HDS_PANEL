import { CanDeactivateFn } from '@angular/router';
import { PickingDetailPage } from './picking-detail';

/** Avisa antes de salir del detalle de picking con cambios sin guardar (doc 89, sección 5.3). */
export const pickingDetailCanDeactivate: CanDeactivateFn<PickingDetailPage> = (component) => {
  if (!component.hasUnsavedChanges()) return true;
  return window.confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardarlos?');
};
