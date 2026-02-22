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
var RoomAutoCleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomAutoCleanupService = void 0;
const common_1 = require("@nestjs/common");
const room_service_1 = require("./room.service");
const room_maintenance_settings_service_1 = require("./room-maintenance-settings.service");
let RoomAutoCleanupService = RoomAutoCleanupService_1 = class RoomAutoCleanupService {
    rooms;
    settings;
    logger = new common_1.Logger(RoomAutoCleanupService_1.name);
    timer = null;
    lastRunAtMs = 0;
    constructor(rooms, settings) {
        this.rooms = rooms;
        this.settings = settings;
    }
    onModuleInit() {
        this.timer = setInterval(() => {
            this.tick().catch(() => { });
        }, 30_000);
        setTimeout(() => {
            this.tick().catch(() => { });
        }, 5_000);
    }
    async onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async tick() {
        const s = this.settings.get();
        if (!s.autoCleanupEnabled) {
            return;
        }
        const now = Date.now();
        if (this.lastRunAtMs &&
            now - this.lastRunAtMs < s.autoCleanupIntervalSeconds * 1000) {
            return;
        }
        this.lastRunAtMs = now;
        const res = await this.rooms.adminCleanupRooms({
            includePrivate: false,
            includeStarted: false,
            olderThanMinutes: s.autoCleanupOlderThanMinutes,
            limit: s.autoCleanupLimit,
            dryRun: false,
            excludeActivePlayers: true,
        });
        if (res.deleted > 0) {
            this.logger.warn(`Auto cleanup removed rooms: deleted=${res.deleted} matched=${res.matched} olderThanMinutes=${s.autoCleanupOlderThanMinutes}`);
        }
    }
};
exports.RoomAutoCleanupService = RoomAutoCleanupService;
exports.RoomAutoCleanupService = RoomAutoCleanupService = RoomAutoCleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [room_service_1.RoomService,
        room_maintenance_settings_service_1.RoomMaintenanceSettingsService])
], RoomAutoCleanupService);
//# sourceMappingURL=room-auto-cleanup.service.js.map