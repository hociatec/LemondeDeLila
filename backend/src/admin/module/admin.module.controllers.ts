import { AdminMaintenanceController } from '../infrastructure/presentation/http/controllers/admin-maintenance.controller';
import { AdminMaintenanceStatusController } from '../infrastructure/presentation/http/controllers/admin-maintenance-status.controller';
import { AdminUsersController } from '../infrastructure/presentation/http/controllers/admin-users.controller';

export const ADMIN_MODULE_CONTROLLERS = [
  AdminUsersController,
  AdminMaintenanceController,
  AdminMaintenanceStatusController,
];
