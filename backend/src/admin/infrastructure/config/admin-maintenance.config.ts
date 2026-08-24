import { ConfigService } from '@nestjs/config';
import {
  ADMIN_SERVICE_RE,
  type AdminMaintenanceConfig,
} from '../../application/ports/admin-maintenance-config.port';

export function createAdminMaintenanceConfig(
  config: ConfigService,
): AdminMaintenanceConfig {
  const healthPortCandidate = Number(config.get<string>('PORT') ?? '3000');
  return {
    deployUnit:
      config.get<string>('ADMIN_MAINTENANCE_DEPLOY_UNIT') ??
      'lila-backend-deploy.service',
    backendService:
      config.get<string>('ADMIN_MAINTENANCE_BACKEND_SERVICE') ??
      'lila-backend.service',
    healthPort:
      Number.isFinite(healthPortCandidate) && healthPortCandidate > 0
        ? healthPortCandidate
        : 3000,
  };
}
