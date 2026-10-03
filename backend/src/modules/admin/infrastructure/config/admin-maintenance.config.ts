import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import type { AdminMaintenanceConfig } from '../../application/ports/admin-maintenance-config.port';

export function createAdminMaintenanceConfig(
  config: ConfigService,
): AdminMaintenanceConfig {
  const healthPortCandidate = Number(config.get<string>('PORT') ?? '3000');
  const deployUnit = String(
    config.get<string>('ADMIN_MAINTENANCE_DEPLOY_UNIT') ??
      'lila-backend-deploy.service',
  ).trim();
  const backendService = String(
    config.get<string>('ADMIN_MAINTENANCE_BACKEND_SERVICE') ??
      'lila-backend.service',
  ).trim();
  const backendRoot = resolve(
    String(
      config.get<string>('ADMIN_MAINTENANCE_BACKEND_ROOT') ??
        resolve(__dirname, '../../../../..'),
    ),
  );
  return {
    deployUnit: deployUnit.slice(0, 128) || 'lila-backend-deploy.service',
    backendService: backendService.slice(0, 128) || 'lila-backend.service',
    backendRoot,
    healthPort:
      Number.isSafeInteger(healthPortCandidate) &&
      healthPortCandidate > 0 &&
      healthPortCandidate <= 65535
        ? healthPortCandidate
        : 3000,
  };
}
