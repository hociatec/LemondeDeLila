"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NotificationService", {
    enumerable: true,
    get: function() {
        return NotificationService;
    }
});
const _common = require("@nestjs/common");
const _ws = require("ws");
const _crypto = require("crypto");
const _notificationtransport = require("./notification-transport");
const _mojibake = require("../../common/utils/mojibake");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let NotificationService = class NotificationService {
    async onModuleDestroy() {
        await this.transport.disconnect();
    }
    register(userId, socket) {
        if (!this.socketsByUserId.has(userId)) {
            this.socketsByUserId.set(userId, new Set());
        }
        this.socketsByUserId.get(userId).add(socket);
    }
    unregister(userId, socket) {
        const set = this.socketsByUserId.get(userId);
        if (!set) return;
        set.delete(socket);
        if (set.size === 0) {
            this.socketsByUserId.delete(userId);
        }
    }
    async notifyUser(userId, type, payload) {
        const repairedPayload = (0, _mojibake.fixMojibakeDeep)(payload);
        await this.transport.publish({
            userId,
            type,
            payload: repairedPayload,
            origin: this.instanceId
        });
        this.dispatchToLocal(userId, type, repairedPayload);
    }
    // Broadcast to all connected users.
    // Implementation detail: userId=0 is treated as a "global" event and dispatched to every socket.
    async notifyAll(type, payload) {
        const repairedPayload = (0, _mojibake.fixMojibakeDeep)(payload);
        await this.transport.publish({
            userId: 0,
            type,
            payload: repairedPayload,
            origin: this.instanceId
        });
        this.dispatchToAllLocal(type, repairedPayload);
    }
    disconnectAll(reason) {
        const payload = typeof reason === 'string' && reason.trim().length > 0 ? {
            reason: reason.trim()
        } : null;
        const message = payload != null ? JSON.stringify({
            type: 'server.disconnect',
            payload
        }) : null;
        for (const [userId, sockets] of Array.from(this.socketsByUserId.entries())){
            for (const socket of Array.from(sockets)){
                if (socket.readyState === _ws.WebSocket.OPEN && message) {
                    try {
                        socket.send(message);
                    } catch  {
                    // ignore
                    }
                }
                try {
                    socket.close(1000, reason ?? 'maintenance');
                } catch  {
                // ignore
                }
            }
            sockets.clear();
            this.socketsByUserId.delete(userId);
        }
    }
    handleExternalEvent(event) {
        const repairedPayload = (0, _mojibake.fixMojibakeDeep)(event.payload);
        if (event.origin === this.instanceId) {
            return;
        }
        if (event.userId === 0) {
            this.dispatchToAllLocal(event.type, repairedPayload);
            return;
        }
        this.dispatchToLocal(event.userId, event.type, repairedPayload);
    }
    dispatchToLocal(userId, type, payload) {
        const targets = this.socketsByUserId.get(userId);
        if (!targets || targets.size === 0) return;
        const message = JSON.stringify({
            type,
            payload
        });
        for (const socket of Array.from(targets)){
            if (socket.readyState !== _ws.WebSocket.OPEN) {
                targets.delete(socket);
                continue;
            }
            try {
                socket.send(message);
            } catch (err) {
                this.logger.debug(`Echec envoi notification userId=${userId}`, err);
                targets.delete(socket);
                try {
                    socket.close();
                } catch  {
                /* ignore */ }
            }
        }
        if (targets.size === 0) {
            this.socketsByUserId.delete(userId);
        }
    }
    dispatchToAllLocal(type, payload) {
        const message = JSON.stringify({
            type,
            payload
        });
        for (const [userId, targets] of Array.from(this.socketsByUserId.entries())){
            for (const socket of Array.from(targets)){
                if (socket.readyState !== _ws.WebSocket.OPEN) {
                    targets.delete(socket);
                    continue;
                }
                try {
                    socket.send(message);
                } catch (err) {
                    this.logger.debug(`Echec envoi notification userId=${userId}`, err);
                    targets.delete(socket);
                    try {
                        socket.close();
                    } catch  {
                    /* ignore */ }
                }
            }
            if (targets.size === 0) {
                this.socketsByUserId.delete(userId);
            }
        }
    }
    constructor(transport){
        this.transport = transport;
        this.logger = new _common.Logger(NotificationService.name);
        this.socketsByUserId = new Map();
        this.instanceId = (0, _crypto.randomUUID)();
        this.transport.subscribe((event)=>this.handleExternalEvent(event)).catch((err)=>this.logger.error('Impossible de souscrire aux notifications', err));
    }
};
NotificationService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _notificationtransport.NotificationTransport === "undefined" ? Object : _notificationtransport.NotificationTransport
    ])
], NotificationService);
