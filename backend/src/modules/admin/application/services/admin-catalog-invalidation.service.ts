import { allCompleted } from '../../../../shared/utils/public-api';
import { Inject, Injectable } from '@nestjs/common';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '@shared/interfaces/public-api';
import { businessMsToIso } from '@shared/utils/public-api';
import {
  ADMIN_CATALOG_CACHE_PORT,
  type AdminCatalogCachePort,
} from '../ports/admin-catalog-cache.port';
import {
  ADMIN_GAME_REGISTRY_PORT,
  type AdminGameRegistryPort,
} from '../ports/admin-game-registry.port';
import {
  ADMIN_NOTIFICATION_PORT,
  type AdminNotificationPort,
} from '../ports/admin-notification.port';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../ports/admin-user.repository';

@Injectable()
export class AdminCatalogInvalidationService {
  constructor(
    @Inject(ADMIN_GAME_REGISTRY_PORT)
    private readonly registry: AdminGameRegistryPort,
    @Inject(ADMIN_CATALOG_CACHE_PORT)
    private readonly catalog: AdminCatalogCachePort,
    @Inject(ADMIN_NOTIFICATION_PORT)
    private readonly notifications: AdminNotificationPort,
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly users: Pick<AdminUserRepository, 'scanIdBatches'>,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async notifyCatalogInvalidated(adminId: number) {
    if (!Number.isSafeInteger(adminId) || adminId <= 0) return;
    const payload = {
      byUserId: adminId,
      timestamp: businessMsToIso(this.clock.now()),
    };
    for await (const ids of this.users.scanIdBatches()) {
      const safeIds = ids
        .filter((userId) => Number.isSafeInteger(userId) && userId > 0)
        .slice(0, 10_000);
      await allCompleted(
        safeIds.map((userId) =>
          this.notifications.notifyUser(userId, 'catalog.invalidate', payload),
        ),
      );
    }
  }

  async invalidateCatalogAndNotify(adminId: number) {
    this.registry.invalidateCache();
    this.catalog.clearCache();
    await this.notifyCatalogInvalidated(adminId);
  }
}
