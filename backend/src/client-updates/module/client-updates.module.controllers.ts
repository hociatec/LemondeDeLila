import { AdminClientUpdatesController } from '../infrastructure/presentation/http/controllers/admin-client-updates.controller';
import { CiClientUpdatesController } from '../infrastructure/presentation/http/controllers/ci-client-updates.controller';
import { ClientUpdatesController } from '../infrastructure/presentation/http/controllers/client-updates.controller';

export const CLIENT_UPDATES_MODULE_CONTROLLERS = [
  ClientUpdatesController,
  AdminClientUpdatesController,
  CiClientUpdatesController,
];
