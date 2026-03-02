"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomAutoCleanupService", {
    enumerable: true,
    get: function() {
        return RoomAutoCleanupService;
    }
});
const _common = require("@nestjs/common");
const _roomservice = require("./room.service");
const _roommaintenancesettingsservice = require("./room-maintenance-settings.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let RoomAutoCleanupService = class RoomAutoCleanupService {
    onModuleInit() {
        // Timer is always running (cheap). Actual execution is gated by settings.
        this.timer = setInterval(()=>{
            this.tick().catch(()=>{});
        }, 30_000);
        setTimeout(()=>{
            this.tick().catch(()=>{});
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
        if (this.lastRunAtMs && now - this.lastRunAtMs < s.autoCleanupIntervalSeconds * 1000) {
            return;
        }
        this.lastRunAtMs = now;
        const res = await this.rooms.adminCleanupRooms({
            includePrivate: false,
            // Inclure aussi les rooms démarrées pour purger les parties "zombies"
            // (sans joueurs actifs) accumulées après des déconnexions prolongées.
            includeStarted: true,
            olderThanMinutes: s.autoCleanupOlderThanMinutes,
            limit: s.autoCleanupLimit,
            dryRun: false,
            excludeActivePlayers: true
        });
        if (res.deleted > 0) {
            this.logger.warn(`Auto cleanup removed rooms: deleted=${res.deleted} matched=${res.matched} olderThanMinutes=${s.autoCleanupOlderThanMinutes}`);
        }
    }
    constructor(rooms, settings){
        this.rooms = rooms;
        this.settings = settings;
        this.logger = new _common.Logger(RoomAutoCleanupService.name);
        this.timer = null;
        this.lastRunAtMs = 0;
    }
};
RoomAutoCleanupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _roomservice.RoomService === "undefined" ? Object : _roomservice.RoomService,
        typeof _roommaintenancesettingsservice.RoomMaintenanceSettingsService === "undefined" ? Object : _roommaintenancesettingsservice.RoomMaintenanceSettingsService
    ])
], RoomAutoCleanupService);
