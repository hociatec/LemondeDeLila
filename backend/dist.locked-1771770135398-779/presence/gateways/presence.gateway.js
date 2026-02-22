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
var PresenceGateway_1;
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const ws_1 = require("ws");
const presence_service_1 = require("../services/presence.service");
const ws_jwt_auth_service_1 = require("../../common/ws/ws-jwt-auth.service");
const ws_ticket_auth_service_1 = require("../../common/ws/ws-ticket-auth.service");
let PresenceGateway = PresenceGateway_1 = class PresenceGateway {
    presence;
    auth;
    wsTickets;
    server;
    logger = new common_1.Logger(PresenceGateway_1.name);
    constructor(presence, auth, wsTickets) {
        this.presence = presence;
        this.auth = auth;
        this.wsTickets = wsTickets;
    }
    async handleConnection(client, ...args) {
        const payload = this.resolveAuth(client, args);
        if (!payload || !payload.id || !payload.username) {
            client.close(4001, 'auth required');
            return;
        }
        if (!this.wsTickets.validate(client, args, 'presence')) {
            client.close(4403, 'ws ticket requis');
            return;
        }
        const context = this.resolveContext(client, args);
        if (context === 'chat') {
            const ban = await this.presence.getChatBanInfo(payload.id);
            if (ban?.until && ban.until.getTime() > Date.now()) {
                try {
                    client.send(JSON.stringify({
                        type: 'error',
                        payload: {
                            message: 'Accès au tchat refusé.',
                            reason: ban.reason ?? null,
                            until: ban.until ? ban.until.toISOString() : null,
                        },
                    }));
                }
                catch {
                }
                client.close(4403, 'chat banned');
                return;
            }
        }
        this.presence.register(client, payload, context);
        client.on('message', (raw) => this.handleIncoming(client, raw));
        client.on('error', () => client.close());
        if (context === 'chat') {
            await this.presence.sendHistory(client);
        }
        this.presence.broadcastPresence();
    }
    handleDisconnect(client) {
        this.presence.unregister(client);
        this.presence.broadcastPresence();
    }
    async handleIncoming(client, raw) {
        const session = this.presence.findClient(client);
        if (!session) {
            client.close();
            return;
        }
        await this.presence.handleClientPayload(session, raw);
    }
    resolveAuth(client, args) {
        const token = this.auth.extractToken(client, args);
        if (!token) {
            return null;
        }
        try {
            return this.auth.verify(token);
        }
        catch (err) {
            this.logger.warn(`Token WS invalide: ${err.message}`);
            throw err;
        }
    }
    resolveContext(client, args) {
        const request = (args && args[0]) || client.upgradeReq || client.req;
        const urlCandidate = client.url || request?.url || '';
        try {
            const url = new URL(urlCandidate, 'ws://localhost');
            const raw = (url.searchParams.get('context') || '').toLowerCase();
            if (raw === 'chat') {
                return 'chat';
            }
        }
        catch {
        }
        return 'home';
    }
};
exports.PresenceGateway = PresenceGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", typeof (_a = typeof ws_1.Server !== "undefined" && ws_1.Server) === "function" ? _a : Object)
], PresenceGateway.prototype, "server", void 0);
exports.PresenceGateway = PresenceGateway = PresenceGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        path: '/presence',
    }),
    __metadata("design:paramtypes", [presence_service_1.PresenceService,
        ws_jwt_auth_service_1.WsJwtAuthService,
        ws_ticket_auth_service_1.WsTicketAuthService])
], PresenceGateway);
//# sourceMappingURL=presence.gateway.js.map