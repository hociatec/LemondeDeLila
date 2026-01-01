import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogService } from '../../catalog/services/catalog.service';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class AdminCatalogInvalidationService {
  constructor(
    private readonly registry: GameRegistryService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async notifyCatalogInvalidated(adminId: number) {
    const ids = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id'])
      .getMany();

    await Promise.all(
      ids.map((u) =>
        this.notifications.notifyUser(u.id, 'catalog.invalidate', {
          byUserId: adminId,
          timestamp: new Date().toISOString(),
        }),
      ),
    );
  }

  async invalidateCatalogAndNotify(adminId: number) {
    this.registry.invalidateCache();
    await this.catalog.clearCache();
    await this.notifyCatalogInvalidated(adminId);
  }
}

