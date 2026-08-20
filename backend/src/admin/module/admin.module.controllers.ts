import { AdminMaintenanceController } from '../infrastructure/presentation/http/controllers/admin-maintenance.controller';
import { AdminUsersController } from '../infrastructure/presentation/http/controllers/admin-users.controller';

export const ADMIN_MODULE_CONTROLLERS = [
  AdminUsersController,
  AdminMaintenanceController,
];
