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
exports.RoomMaintenanceSettingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const room_maintenance_settings_entity_1 = require("../entities/room-maintenance-settings.entity");
let RoomMaintenanceSettingsService = class RoomMaintenanceSettingsService {
    repo;
    cache = null;
    constructor(repo) {
        this.repo = repo;
    }
    async onModuleInit() {
        await this.ensureSeeded();
    }
    defaults() {
        const enabledRaw = (process.env.ROOM_AUTO_CLEANUP_ENABLED || '')
            .trim()
            .toLowerCase();
        const enabled = enabledRaw === '1' ||
            enabledRaw === 'true' ||
            enabledRaw === 'yes' ||
            enabledRaw === 'y';
        const intervalSeconds = Number.parseInt((process.env.ROOM_AUTO_CLEANUP_INTERVAL_SECONDS || '300').trim(), 10);
        const olderThanMinutes = Number.parseInt((process.env.ROOM_AUTO_CLEANUP_OLDER_THAN_MINUTES || '60').trim(), 10);
        const limit = Number.parseInt((process.env.ROOM_AUTO_CLEANUP_LIMIT || '1000').trim(), 10);
        return this.normalize({
            autoCleanupEnabled: enabled,
            autoCleanupIntervalSeconds: intervalSeconds,
            autoCleanupOlderThanMinutes: olderThanMinutes,
            autoCleanupLimit: limit,
        });
    }
    normalize(input) {
        const enabled = input.autoCleanupEnabled === true;
        const interval = Number.isFinite(input.autoCleanupIntervalSeconds)
            ? Math.max(30, Math.floor(input.autoCleanupIntervalSeconds))
            : 300;
        const older = Number.isFinite(input.autoCleanupOlderThanMinutes)
            ? Math.max(5, Math.floor(input.autoCleanupOlderThanMinutes))
            : 60;
        const limit = Number.isFinite(input.autoCleanupLimit)
            ? Math.max(1, Math.min(5000, Math.floor(input.autoCleanupLimit)))
            : 1000;
        return {
            autoCleanupEnabled: enabled,
            autoCleanupIntervalSeconds: interval,
            autoCleanupOlderThanMinutes: older,
            autoCleanupLimit: limit,
        };
    }
    get() {
        return this.cache ?? this.defaults();
    }
    async update(patch) {
        await this.ensureSeeded();
        const current = this.get();
        const next = this.normalize({ ...current, ...patch });
        await this.repo.save({
            id: 1,
            autoCleanupEnabled: next.autoCleanupEnabled,
            autoCleanupIntervalSeconds: next.autoCleanupIntervalSeconds,
            autoCleanupOlderThanMinutes: next.autoCleanupOlderThanMinutes,
            autoCleanupLimit: next.autoCleanupLimit,
        });
        this.cache = next;
        return next;
    }
    async ensureSeeded() {
        if (this.cache)
            return;
        const existing = await this.repo.findOne({ where: { id: 1 } });
        if (existing) {
            this.cache = this.normalize({
                autoCleanupEnabled: existing.autoCleanupEnabled,
                autoCleanupIntervalSeconds: existing.autoCleanupIntervalSeconds,
                autoCleanupOlderThanMinutes: existing.autoCleanupOlderThanMinutes,
                autoCleanupLimit: existing.autoCleanupLimit,
            });
            return;
        }
        const seed = this.defaults();
        await this.repo.insert({
            id: 1,
            autoCleanupEnabled: seed.autoCleanupEnabled,
            autoCleanupIntervalSeconds: seed.autoCleanupIntervalSeconds,
            autoCleanupOlderThanMinutes: seed.autoCleanupOlderThanMinutes,
            autoCleanupLimit: seed.autoCleanupLimit,
        });
        this.cache = seed;
    }
};
exports.RoomMaintenanceSettingsService = RoomMaintenanceSettingsService;
exports.RoomMaintenanceSettingsService = RoomMaintenanceSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(room_maintenance_settings_entity_1.RoomMaintenanceSettingsEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], RoomMaintenanceSettingsService);
//# sourceMappingURL=room-maintenance-settings.service.js.map