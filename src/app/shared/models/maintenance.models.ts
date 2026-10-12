// Modo mantenimiento (/api/admin/maintenance). Ver doc 38, sección 4.7.

export interface MaintenanceStatusView {
  enabled: boolean;
  reason: string | null; // null si está inactivo
  enabledAt: string | null; // ISO datetime, null si está inactivo
  enabledBy: string | null; // null si está inactivo
  message: string; // "Mantenimiento activo: <motivo>" o "Sistema operativo"
}
