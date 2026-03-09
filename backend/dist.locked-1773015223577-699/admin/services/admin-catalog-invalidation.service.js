"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminCatalogInvalidationService", {
    enumerable: true,
    get: function() {
        return AdminCatalogInvalidationService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _catalogservice = require("../../catalog/services/catalog.service");
const _gameregistryservice = require("../../game/engine/services/game-registry.service");
const _notificationservice = require("../../notification/services/notification.service");
const _userentity = require("../../user/entities/user.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let AdminCatalogInvalidationService = class AdminCatalogInvalidationService {
    async notifyCatalogInvalidated(adminId) {
        const ids = await this.userRepo.createQueryBuilder('u').select([
            'u.id'
        ]).getMany();
        await Promise.all(ids.map((u)=>this.notifications.notifyUser(u.id, 'catalog.invalidate', {
                byUserId: adminId,
                timestamp: new Date().toISOString()
            })));
    }
    async invalidateCatalogAndNotify(adminId) {
        this.registry.invalidateCache();
        this.catalog.clearCache();
        await this.notifyCatalogInvalidated(adminId);
    }
    constructor(registry, catalog, notifications, userRepo){
        this.registry = registry;
        this.catalog = catalog;
        this.notifications = notifications;
        this.userRepo = userRepo;
    }
};
AdminCatalogInvalidationService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(3, (0, _typeorm.InjectRepository)(_userentity.User)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _catalogservice.CatalogService === "undefined" ? Object : _catalogservice.CatalogService,
        typeof _notificationservice.NotificationService === "undefined" ? Object : _notificationservice.NotificationService,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], AdminCatalogInvalidationService);
