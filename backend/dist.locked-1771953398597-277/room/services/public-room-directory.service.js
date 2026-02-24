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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicRoomDirectoryService = void 0;
const common_1 = require("@nestjs/common");
const ws_api_hub_service_1 = require("../../common/ws/ws-api-hub.service");
let PublicRoomDirectoryService = class PublicRoomDirectoryService {
    hub;
    subscriptions = new Map();
    pending = null;
    flushTimer = null;
    flushDelayMs = 250;
    constructor(hub) {
        this.hub = hub;
    }
    subscribe(connectionId, gameType) {
        if (!connectionId || !connectionId.trim())
            return;
        const normalized = typeof gameType === 'string' ? gameType.trim() : '';
        this.subscriptions.set(connectionId, { gameType: normalized || null });
    }
    unsubscribe(connectionId) {
        if (!connectionId || !connectionId.trim())
            return;
        this.subscriptions.delete(connectionId);
    }
    notifyRefresh(roomId, reason) {
        const next = {
            roomId: typeof roomId === 'number' && Number.isFinite(roomId) ? roomId : null,
            reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
        };
        this.pending = this.pending ?? next;
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flush(), this.flushDelayMs);
        }
    }
    flush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        const payload = this.pending;
        this.pending = null;
        const connectionIds = Array.from(this.subscriptions.keys());
        if (connectionIds.length === 0)
            return;
        const message = {
            type: 'rooms.public.refresh',
            requestId: 'push',
            payload: payload ?? { roomId: null, reason: null },
        };
        for (const connectionId of connectionIds) {
            const ok = this.hub.send(connectionId, message);
            if (!ok) {
                this.subscriptions.delete(connectionId);
            }
        }
    }
};
exports.PublicRoomDirectoryService = PublicRoomDirectoryService;
exports.PublicRoomDirectoryService = PublicRoomDirectoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_api_hub_service_1.WsApiHubService])
], PublicRoomDirectoryService);
//# sourceMappingURL=public-room-directory.service.js.map