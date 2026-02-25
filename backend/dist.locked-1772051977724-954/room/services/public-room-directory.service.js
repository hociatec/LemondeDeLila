"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PublicRoomDirectoryService", {
    enumerable: true,
    get: function() {
        return PublicRoomDirectoryService;
    }
});
const _common = require("@nestjs/common");
const _wsapihubservice = require("../../common/ws/ws-api-hub.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let PublicRoomDirectoryService = class PublicRoomDirectoryService {
    subscribe(connectionId, gameType) {
        if (!connectionId || !connectionId.trim()) return;
        const normalized = typeof gameType === 'string' ? gameType.trim() : '';
        this.subscriptions.set(connectionId, {
            gameType: normalized || null
        });
    }
    unsubscribe(connectionId) {
        if (!connectionId || !connectionId.trim()) return;
        this.subscriptions.delete(connectionId);
    }
    notifyRefresh(roomId, reason) {
        // Coalesce bursts (join/leave/bot/etc.) into a single refresh push.
        const next = {
            roomId: typeof roomId === 'number' && Number.isFinite(roomId) ? roomId : null,
            reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null
        };
        this.pending = this.pending ?? next;
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(()=>this.flush(), this.flushDelayMs);
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
        if (connectionIds.length === 0) return;
        const message = {
            type: 'rooms.public.refresh',
            requestId: 'push',
            payload: payload ?? {
                roomId: null,
                reason: null
            }
        };
        for (const connectionId of connectionIds){
            // For now we ignore per-gameType filtering and let clients request with filters.
            const ok = this.hub.send(connectionId, message);
            if (!ok) {
                this.subscriptions.delete(connectionId);
            }
        }
    }
    constructor(hub){
        this.hub = hub;
        this.subscriptions = new Map();
        this.pending = null;
        this.flushTimer = null;
        this.flushDelayMs = 250;
    }
};
PublicRoomDirectoryService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsapihubservice.WsApiHubService === "undefined" ? Object : _wsapihubservice.WsApiHubService
    ])
], PublicRoomDirectoryService);
