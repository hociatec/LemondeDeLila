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
var RealtimeApiGateway_1;
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeApiGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const ws_1 = require("ws");
const crypto_1 = require("crypto");
const session_store_interface_1 = require("../../common/session/session-store.interface");
const ws_route_registry_service_1 = require("../../common/ws/ws-route-registry.service");
const ws_jwt_auth_service_1 = require("../../common/ws/ws-jwt-auth.service");
const client_updates_service_1 = require("../../client-updates/services/client-updates.service");
const version_utils_1 = require("../../common/utils/version.utils");
const ws_ticket_auth_service_1 = require("../../common/ws/ws-ticket-auth.service");
const ws_api_hub_service_1 = require("../../common/ws/ws-api-hub.service");
let RealtimeApiGateway = RealtimeApiGateway_1 = class RealtimeApiGateway {
    registry;
    auth;
    sessionStore;
    clientUpdates;
    wsTickets;
    hub;
    server;
    clients = new Map();
    logger = new common_1.Logger(RealtimeApiGateway_1.name);
    constructor(registry, auth, sessionStore, clientUpdates, wsTickets, hub) {
        this.registry = registry;
        this.auth = auth;
        this.sessionStore = sessionStore;
        this.clientUpdates = clientUpdates;
        this.wsTickets = wsTickets;
        this.hub = hub;
    }
    async handleConnection(client, ...args) {
        const connectionId = (0, crypto_1.randomUUID)();
        const clientVersion = this.auth.extractClientVersion(client, args);
        const token = this.auth.extractToken(client, args);
        const ticketValidation = this.wsTickets.validateIfTokenPresentDetailed(client, args, 'api', Boolean(token));
        if (!ticketValidation.ok) {
            this.logger.warn(`Connexion WS refusée (ticket) reason=${ticketValidation.reason} hasToken=${Boolean(token)} clientVersion=${clientVersion ?? 'n/a'} connectionId=${connectionId}`);
            try {
                const reason = ticketValidation.reason === 'missing_ticket'
                    ? 'ws ticket requis'
                    : 'ws ticket invalide';
                client.close(4403, reason);
            }
            catch {
            }
            return;
        }
        const session = {
            socket: client,
            user: null,
            connectionId,
            clientVersion,
        };
        if (token) {
            try {
                session.user = this.auth.verify(token);
            }
            catch (err) {
                this.logger.warn(`Connexion WS sans auth valide: ${err.message}`);
            }
        }
        this.clients.set(client, session);
        this.hub.register(connectionId, client);
        client.on('message', (raw) => this.handleIncoming(client, raw));
        client.on('error', () => client.close());
        try {
            await this.sessionStore.save(connectionId, {
                userId: session.user?.id ?? null,
                username: session.user?.username,
                roles: session.user?.roles ?? null,
            });
        }
        catch (err) {
            this.logger.warn(`Impossible de persister la session WS (connectionId=${connectionId}): ${err.message}`);
        }
    }
    handleDisconnect(client) {
        const session = this.clients.get(client);
        this.clients.delete(client);
        if (session) {
            this.sessionStore.delete(session.connectionId).catch(() => { });
            this.hub.unregister(session.connectionId);
        }
    }
    async handleIncoming(client, raw) {
        const session = this.clients.get(client);
        if (!session) {
            client.close();
            return;
        }
        const decoded = this.decode(raw);
        if (!decoded?.type) {
            this.logger.debug(`Message WS ignoré (invalide ou sans type) connectionId=${session.connectionId}`);
            return;
        }
        const { type, payload, requestId } = decoded;
        const minRequired = await this.clientUpdates.getMinRequiredVersion();
        if (minRequired &&
            (!session.clientVersion ||
                (0, version_utils_1.isVersionLower)(session.clientVersion, minRequired) === true)) {
            this.sendError(client, `Mise à jour requise (version minimale: ${minRequired}).`, type, requestId);
            try {
                client.close(4406, 'update required');
            }
            catch {
            }
            return;
        }
        try {
            if (type === 'r' || type === 'R') {
                return;
            }
            const handler = this.registry.get(type);
            if (!handler) {
                this.logger.warn(`Type WS inconnu: ${type} (requestId=${requestId ?? 'n/a'})`);
                this.sendError(client, 'Type de message inconnu', type, requestId);
                return;
            }
            const start = Date.now();
            this.logger.debug(`WS -> backend type=${type} requestId=${requestId ?? 'n/a'} userId=${session.user?.id ?? 'anon'} connectionId=${session.connectionId}`);
            const response = await handler(session, payload);
            const elapsedMs = Date.now() - start;
            if (elapsedMs >= 2000) {
                this.logger.warn(`WS handler lent: ${type} (${elapsedMs}ms) requestId=${requestId ?? 'n/a'}`);
            }
            else {
                this.logger.debug(`WS handler ok: ${type} (${elapsedMs}ms) requestId=${requestId ?? 'n/a'}`);
            }
            if (response) {
                this.safeSend(client, { requestId, ...response });
            }
        }
        catch (err) {
            this.sendError(client, this.formatError(err), type, requestId);
        }
    }
    decode(raw) {
        let text = '';
        if (typeof raw === 'string') {
            text = raw;
        }
        else if (Buffer.isBuffer(raw)) {
            text = raw.toString('utf-8');
        }
        else if (raw && typeof raw === 'object' && 'byteLength' in raw) {
            text = Buffer.from(raw).toString('utf-8');
        }
        else {
            return null;
        }
        if (!text.trim()) {
            return null;
        }
        try {
            return JSON.parse(text);
        }
        catch {
            return null;
        }
    }
    safeSend(client, payload) {
        if (client.readyState !== ws_1.WebSocket.OPEN)
            return;
        try {
            client.send(JSON.stringify(payload));
        }
        catch (err) {
            this.logger.warn('Echec envoi WS', err);
            try {
                client.close();
            }
            catch {
            }
        }
    }
    sendError(client, message, context, requestId) {
        this.safeSend(client, {
            type: 'error',
            requestId,
            context,
            payload: { message },
        });
    }
    formatError(err) {
        if (err &&
            typeof err === 'object' &&
            'message' in err &&
            typeof err.message === 'string') {
            return err.message;
        }
        return 'Erreur inconnue';
    }
};
exports.RealtimeApiGateway = RealtimeApiGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", typeof (_a = typeof ws_1.Server !== "undefined" && ws_1.Server) === "function" ? _a : Object)
], RealtimeApiGateway.prototype, "server", void 0);
exports.RealtimeApiGateway = RealtimeApiGateway = RealtimeApiGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        path: '/ws/api',
    }),
    __param(2, (0, common_1.Inject)(session_store_interface_1.SESSION_STORE)),
    __metadata("design:paramtypes", [ws_route_registry_service_1.WsRouteRegistry,
        ws_jwt_auth_service_1.WsJwtAuthService, Object, client_updates_service_1.ClientUpdatesService,
        ws_ticket_auth_service_1.WsTicketAuthService,
        ws_api_hub_service_1.WsApiHubService])
], RealtimeApiGateway);
//# sourceMappingURL=realtime-api.gateway.js.map