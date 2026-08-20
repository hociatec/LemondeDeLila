import { AdminClientUpdatesController } from '../controllers/admin-client-updates.controller';
import { CiClientUpdatesController } from '../controllers/ci-client-updates.controller';
import { ClientUpdatesController } from '../controllers/client-updates.controller';

export const CLIENT_UPDATES_MODULE_CONTROLLERS = [
  ClientUpdatesController,
  AdminClientUpdatesController,
  CiClientUpdatesController,
];
