"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomMaintenanceSettingsService", {
    enumerable: true,
    get: function() {
        return RoomMaintenanceSettingsService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _roommaintenancesettingsentity = require("../entities/room-maintenance-settings.entity");
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
let RoomMaintenanceSettingsService = class RoomMaintenanceSettingsService {
    async onModuleInit() {
        await this.ensureSeeded();
    }
    defaults() {
        const enabledRaw = (process.env.ROOM_AUTO_CLEANUP_ENABLED || '').trim().toLowerCase();
        const enabled = enabledRaw === '1' || enabledRaw === 'true' || enabledRaw === 'yes' || enabledRaw === 'y';
        const intervalSeconds = Number.parseInt((process.env.ROOM_AUTO_CLEANUP_INTERVAL_SECONDS || '300').trim(), 10);
        const olderThanMinutes = Number.parseInt((process.env.ROOM_AUTO_CLEANUP_OLDER_THAN_MINUTES || '60').trim(), 10);
        const limit = Number.parseInt((process.env.ROOM_AUTO_CLEANUP_LIMIT || '1000').trim(), 10);
        return this.normalize({
            autoCleanupEnabled: enabled,
            autoCleanupIntervalSeconds: intervalSeconds,
            autoCleanupOlderThanMinutes: olderThanMinutes,
            autoCleanupLimit: limit
        });
    }
    normalize(input) {
        const enabled = input.autoCleanupEnabled === true;
        const interval = Number.isFinite(input.autoCleanupIntervalSeconds) ? Math.max(30, Math.floor(input.autoCleanupIntervalSeconds)) : 300;
        const older = Number.isFinite(input.autoCleanupOlderThanMinutes) ? Math.max(5, Math.floor(input.autoCleanupOlderThanMinutes)) : 60;
        const limit = Number.isFinite(input.autoCleanupLimit) ? Math.max(1, Math.min(5000, Math.floor(input.autoCleanupLimit))) : 1000;
        return {
            autoCleanupEnabled: enabled,
            autoCleanupIntervalSeconds: interval,
            autoCleanupOlderThanMinutes: older,
            autoCleanupLimit: limit
        };
    }
    get() {
        return this.cache ?? this.defaults();
    }
    async update(patch) {
        await this.ensureSeeded();
        const current = this.get();
        const next = this.normalize({
            ...current,
            ...patch
        });
        await this.repo.save({
            id: 1,
            autoCleanupEnabled: next.autoCleanupEnabled,
            autoCleanupIntervalSeconds: next.autoCleanupIntervalSeconds,
            autoCleanupOlderThanMinutes: next.autoCleanupOlderThanMinutes,
            autoCleanupLimit: next.autoCleanupLimit
        });
        this.cache = next;
        return next;
    }
    async ensureSeeded() {
        if (this.cache) return;
        const existing = await this.repo.findOne({
            where: {
                id: 1
            }
        });
        if (existing) {
            this.cache = this.normalize({
                autoCleanupEnabled: existing.autoCleanupEnabled,
                autoCleanupIntervalSeconds: existing.autoCleanupIntervalSeconds,
                autoCleanupOlderThanMinutes: existing.autoCleanupOlderThanMinutes,
                autoCleanupLimit: existing.autoCleanupLimit
            });
            return;
        }
        const seed = this.defaults();
        await this.repo.insert({
            id: 1,
            autoCleanupEnabled: seed.autoCleanupEnabled,
            autoCleanupIntervalSeconds: seed.autoCleanupIntervalSeconds,
            autoCleanupOlderThanMinutes: seed.autoCleanupOlderThanMinutes,
            autoCleanupLimit: seed.autoCleanupLimit
        });
        this.cache = seed;
    }
    constructor(repo){
        this.repo = repo;
        this.cache = null;
    }
};
RoomMaintenanceSettingsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_roommaintenancesettingsentity.RoomMaintenanceSettingsEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], RoomMaintenanceSettingsService);
