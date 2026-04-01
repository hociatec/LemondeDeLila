"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PresenceGateway", {
    enumerable: true,
    get: function() {
        return PresenceGateway;
    }
});
const _websockets = require("@nestjs/websockets");
const _common = require("@nestjs/common");
const _ws = require("ws");
const _presenceservice = require("../services/presence.service");
const _wsjwtauthservice = require("../../common/ws/ws-jwt-auth.service");
const _wsticketauthservice = require("../../common/ws/ws-ticket-auth.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let PresenceGateway = class PresenceGateway {
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
                            until: ban.until ? ban.until.toISOString() : null
                        }
                    }));
                } catch  {
                /* ignore */ }
                client.close(4403, 'chat banned');
                return;
            }
        }
        this.presence.register(client, payload, context);
        client.on('message', (raw)=>this.handleIncoming(client, raw));
        client.on('error', ()=>client.close());
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
        // IMPORTANT: ne pas logger chaque message en production (latence + I/O disque).
        await this.presence.handleClientPayload(session, raw);
    }
    resolveAuth(client, args) {
        const token = this.auth.extractToken(client, args);
        if (!token) {
            return null;
        }
        try {
            return this.auth.verify(token);
        } catch (err) {
            this.logger.warn(`Token WS invalide: ${err.message}`);
            // on refuse explicitement la connexion pour informer le client
            throw err;
        }
    }
    resolveContext(client, args) {
        const request = args && args[0] || client.upgradeReq || client.req;
        const urlCandidate = client.url || request?.url || '';
        try {
            const url = new URL(urlCandidate, 'ws://localhost');
            const raw = (url.searchParams.get('context') || '').toLowerCase();
            if (raw === 'chat') {
                return 'chat';
            }
        } catch  {
        /* ignore */ }
        return 'home';
    }
    constructor(presence, auth, wsTickets){
        this.presence = presence;
        this.auth = auth;
        this.wsTickets = wsTickets;
        this.logger = new _common.Logger(PresenceGateway.name);
    // Auth JWT is handled by WsJwtAuthService (RS256/HS256 depending on configuration).
    }
};
_ts_decorate([
    (0, _websockets.WebSocketServer)(),
    _ts_metadata("design:type", typeof _ws.Server === "undefined" ? Object : _ws.Server)
], PresenceGateway.prototype, "server", void 0);
PresenceGateway = _ts_decorate([
    (0, _websockets.WebSocketGateway)({
        path: '/presence'
    }),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _presenceservice.PresenceService === "undefined" ? Object : _presenceservice.PresenceService,
        typeof _wsjwtauthservice.WsJwtAuthService === "undefined" ? Object : _wsjwtauthservice.WsJwtAuthService,
        typeof _wsticketauthservice.WsTicketAuthService === "undefined" ? Object : _wsticketauthservice.WsTicketAuthService
    ])
], PresenceGateway);
