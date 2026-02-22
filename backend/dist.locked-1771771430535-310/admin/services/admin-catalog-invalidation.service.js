"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminCatalogInvalidationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_service_1 = require("../../catalog/services/catalog.service");
const game_registry_service_1 = require("../../game/engine/services/game-registry.service");
const notification_service_1 = require("../../notification/services/notification.service");
const user_entity_1 = require("../../user/entities/user.entity");
let AdminCatalogInvalidationService = class AdminCatalogInvalidationService {
    registry;
    catalog;
    notifications;
    userRepo;
    constructor(registry, catalog, notifications, userRepo) {
        this.registry = registry;
        this.catalog = catalog;
        this.notifications = notifications;
        this.userRepo = userRepo;
    }
    async notifyCatalogInvalidated(adminId) {
        const ids = await this.userRepo
            .createQueryBuilder('u')
            .select(['u.id'])
            .getMany();
        await Promise.all(ids.map((u) => this.notifications.notifyUser(u.id, 'catalog.invalidate', {
            byUserId: adminId,
            timestamp: new Date().toISOString(),
        })));
    }
    async invalidateCatalogAndNotify(adminId) {
        this.registry.invalidateCache();
        this.catalog.clearCache();
        await this.notifyCatalogInvalidated(adminId);
    }
};
exports.AdminCatalogInvalidationService = AdminCatalogInvalidationService;
exports.AdminCatalogInvalidationService = AdminCatalogInvalidationService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [game_registry_service_1.GameRegistryService,
        catalog_service_1.CatalogService,
        notification_service_1.NotificationService,
        typeorm_2.Repository])
], AdminCatalogInvalidationService);
//# sourceMappingURL=admin-catalog-invalidation.service.js.map