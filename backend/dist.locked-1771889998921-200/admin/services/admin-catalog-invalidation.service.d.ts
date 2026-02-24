import { Repository } from 'typeorm';
import { CatalogService } from '../../catalog/services/catalog.service';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
export declare class AdminCatalogInvalidationService {
    private readonly registry;
    private readonly catalog;
    private readonly notifications;
    private readonly userRepo;
    constructor(registry: GameRegistryService, catalog: CatalogService, notifications: NotificationService, userRepo: Repository<User>);
    notifyCatalogInvalidated(adminId: number): Promise<void>;
    invalidateCatalogAndNotify(adminId: number): Promise<void>;
}
