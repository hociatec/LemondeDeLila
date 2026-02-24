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
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const ws_1 = require("ws");
const crypto_1 = require("crypto");
const notification_transport_1 = require("./notification-transport");
let NotificationService = NotificationService_1 = class NotificationService {
    transport;
    logger = new common_1.Logger(NotificationService_1.name);
    socketsByUserId = new Map();
    instanceId = (0, crypto_1.randomUUID)();
    constructor(transport) {
        this.transport = transport;
        this.transport
            .subscribe((event) => this.handleExternalEvent(event))
            .catch((err) => this.logger.error('Impossible de souscrire aux notifications', err));
    }
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
        if (!set)
            return;
        set.delete(socket);
        if (set.size === 0) {
            this.socketsByUserId.delete(userId);
        }
    }
    async notifyUser(userId, type, payload) {
        await this.transport.publish({
            userId,
            type,
            payload,
            origin: this.instanceId,
        });
        this.dispatchToLocal(userId, type, payload);
    }
    async notifyAll(type, payload) {
        await this.transport.publish({
            userId: 0,
            type,
            payload,
            origin: this.instanceId,
        });
        this.dispatchToAllLocal(type, payload);
    }
    disconnectAll(reason) {
        const payload = typeof reason === 'string' && reason.trim().length > 0
            ? { reason: reason.trim() }
            : null;
        const message = payload != null
            ? JSON.stringify({ type: 'server.disconnect', payload })
            : null;
        for (const [userId, sockets] of Array.from(this.socketsByUserId.entries())) {
            for (const socket of Array.from(sockets)) {
                if (socket.readyState === ws_1.WebSocket.OPEN && message) {
                    try {
                        socket.send(message);
                    }
                    catch {
                    }
                }
                try {
                    socket.close(1000, reason ?? 'maintenance');
                }
                catch {
                }
            }
            sockets.clear();
            this.socketsByUserId.delete(userId);
        }
    }
    handleExternalEvent(event) {
        if (event.origin === this.instanceId) {
            return;
        }
        if (event.userId === 0) {
            this.dispatchToAllLocal(event.type, event.payload);
            return;
        }
        this.dispatchToLocal(event.userId, event.type, event.payload);
    }
    dispatchToLocal(userId, type, payload) {
        const targets = this.socketsByUserId.get(userId);
        if (!targets || targets.size === 0)
            return;
        const message = JSON.stringify({ type, payload });
        for (const socket of Array.from(targets)) {
            if (socket.readyState !== ws_1.WebSocket.OPEN) {
                targets.delete(socket);
                continue;
            }
            try {
                socket.send(message);
            }
            catch (err) {
                this.logger.debug(`Echec envoi notification userId=${userId}`, err);
                targets.delete(socket);
                try {
                    socket.close();
                }
                catch {
                }
            }
        }
        if (targets.size === 0) {
            this.socketsByUserId.delete(userId);
        }
    }
    dispatchToAllLocal(type, payload) {
        const message = JSON.stringify({ type, payload });
        for (const [userId, targets] of Array.from(this.socketsByUserId.entries())) {
            for (const socket of Array.from(targets)) {
                if (socket.readyState !== ws_1.WebSocket.OPEN) {
                    targets.delete(socket);
                    continue;
                }
                try {
                    socket.send(message);
                }
                catch (err) {
                    this.logger.debug(`Echec envoi notification userId=${userId}`, err);
                    targets.delete(socket);
                    try {
                        socket.close();
                    }
                    catch {
                    }
                }
            }
            if (targets.size === 0) {
                this.socketsByUserId.delete(userId);
            }
        }
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notification_transport_1.NotificationTransport])
], NotificationService);
//# sourceMappingURL=notification.service.js.map