import { Inject, Injectable } from '@nestjs/common';
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
    private readonly users: AdminUserRepository,
  ) {}

  async notifyCatalogInvalidated(adminId: number) {
    const ids = await this.users.listIds();

    await Promise.all(
      ids.map((userId) =>
        this.notifications.notifyUser(userId, 'catalog.invalidate', {
          byUserId: adminId,
          timestamp: new Date().toISOString(),
        }),
      ),
    );
  }

  async invalidateCatalogAndNotify(adminId: number) {
    this.registry.invalidateCache();
    this.catalog.clearCache();
    await this.notifyCatalogInvalidated(adminId);
  }
}

