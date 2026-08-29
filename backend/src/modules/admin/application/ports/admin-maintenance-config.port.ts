export const ADMIN_MAINTENANCE_CONFIG = Symbol('ADMIN_MAINTENANCE_CONFIG');

export type AdminMaintenanceConfig = {
  deployUnit: string;
  backendService: string;
  healthPort: number;
};

export const ADMIN_SERVICE_RE = /^[a-zA-Z0-9@._-]+$/;
