"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RealtimeApiGateway", {
    enumerable: true,
    get: function() {
        return RealtimeApiGateway;
    }
});
const _common = require("@nestjs/common");
const _websockets = require("@nestjs/websockets");
const _ws = require("ws");
const _crypto = require("crypto");
const _sessionstoreinterface = require("../../common/session/session-store.interface");
const _wsrouteregistryservice = require("../../common/ws/ws-route-registry.service");
const _wsjwtauthservice = require("../../common/ws/ws-jwt-auth.service");
const _clientupdatesservice = require("../../client-updates/services/client-updates.service");
const _versionutils = require("../../common/utils/version.utils");
const _wsticketauthservice = require("../../common/ws/ws-ticket-auth.service");
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
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let RealtimeApiGateway = class RealtimeApiGateway {
    async handleConnection(client, ...args) {
        const connectionId = (0, _crypto.randomUUID)();
        const clientVersion = this.auth.extractClientVersion(client, args);
        const token = this.auth.extractToken(client, args);
        const ticketValidation = this.wsTickets.validateIfTokenPresentDetailed(client, args, 'api', Boolean(token));
        if (!ticketValidation.ok) {
            this.logger.warn(`Connexion WS refusée (ticket) reason=${ticketValidation.reason} hasToken=${Boolean(token)} clientVersion=${clientVersion ?? 'n/a'} connectionId=${connectionId}`);
            try {
                const reason = ticketValidation.reason === 'missing_ticket' ? 'ws ticket requis' : 'ws ticket invalide';
                client.close(4403, reason);
            } catch  {
            /* ignore */ }
            return;
        }
        const session = {
            socket: client,
            user: null,
            connectionId,
            clientVersion
        };
        if (token) {
            try {
                session.user = this.auth.verify(token);
            } catch (err) {
                this.logger.warn(`Connexion WS sans auth valide: ${err.message}`);
            }
        }
        this.clients.set(client, session);
        this.hub.register(connectionId, client);
        // IMPORTANT: attacher les handlers AVANT tout `await`.
        // Sinon, un client qui envoie un message immédiatement après le handshake (cas fréquent)
        // peut se faire "perdre" le premier message car aucun listener n'est encore abonné.
        client.on('message', (raw)=>this.handleIncoming(client, raw));
        client.on('error', ()=>client.close());
        try {
            await this.sessionStore.save(connectionId, {
                userId: session.user?.id ?? null,
                username: session.user?.username,
                roles: session.user?.roles ?? null
            });
        } catch (err) {
            // Ne pas bloquer la connexion WS si Redis est lent/indisponible : le client peut tout de même utiliser l'API WS.
            this.logger.warn(`Impossible de persister la session WS (connectionId=${connectionId}): ${err.message}`);
        }
    }
    handleDisconnect(client) {
        const session = this.clients.get(client);
        this.clients.delete(client);
        if (session) {
            this.sessionStore.delete(session.connectionId).catch(()=>{});
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
        if (minRequired && (!session.clientVersion || (0, _versionutils.isVersionLower)(session.clientVersion, minRequired) === true)) {
            this.sendError(client, `Mise à jour requise (version minimale: ${minRequired}).`, type, requestId);
            try {
                client.close(4406, 'update required');
            } catch  {
            /* ignore */ }
            return;
        }
        try {
            // Some clients historically sent raw key types (ex: "r"). Ignore them to avoid spurious errors.
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
            } else {
                this.logger.debug(`WS handler ok: ${type} (${elapsedMs}ms) requestId=${requestId ?? 'n/a'}`);
            }
            if (response) {
                this.safeSend(client, {
                    requestId,
                    ...response
                });
            }
        } catch (err) {
            this.sendError(client, this.formatError(err), type, requestId);
        }
    }
    decode(raw) {
        let text = '';
        if (typeof raw === 'string') {
            text = raw;
        } else if (Buffer.isBuffer(raw)) {
            text = raw.toString('utf-8');
        } else if (raw && typeof raw === 'object' && 'byteLength' in raw) {
            text = Buffer.from(raw).toString('utf-8');
        } else {
            return null;
        }
        if (!text.trim()) {
            return null;
        }
        try {
            return JSON.parse(text);
        } catch  {
            return null;
        }
    }
    safeSend(client, payload) {
        if (client.readyState !== _ws.WebSocket.OPEN) return;
        try {
            client.send(JSON.stringify(payload));
        } catch (err) {
            this.logger.warn('Echec envoi WS', err);
            try {
                client.close();
            } catch  {
            /* ignore */ }
        }
    }
    sendError(client, message, context, requestId) {
        this.safeSend(client, {
            type: 'error',
            requestId,
            context,
            payload: {
                message
            }
        });
    }
    formatError(err) {
        if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
            return err.message;
        }
        return 'Erreur inconnue';
    }
    constructor(registry, auth, sessionStore, clientUpdates, wsTickets, hub){
        this.registry = registry;
        this.auth = auth;
        this.sessionStore = sessionStore;
        this.clientUpdates = clientUpdates;
        this.wsTickets = wsTickets;
        this.hub = hub;
        this.clients = new Map();
        this.logger = new _common.Logger(RealtimeApiGateway.name);
    }
};
_ts_decorate([
    (0, _websockets.WebSocketServer)(),
    _ts_metadata("design:type", typeof _ws.Server === "undefined" ? Object : _ws.Server)
], RealtimeApiGateway.prototype, "server", void 0);
RealtimeApiGateway = _ts_decorate([
    (0, _websockets.WebSocketGateway)({
        path: '/ws/api'
    }),
    _ts_param(2, (0, _common.Inject)(_sessionstoreinterface.SESSION_STORE)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry,
        typeof _wsjwtauthservice.WsJwtAuthService === "undefined" ? Object : _wsjwtauthservice.WsJwtAuthService,
        typeof SessionStateStore === "undefined" ? Object : SessionStateStore,
        typeof _clientupdatesservice.ClientUpdatesService === "undefined" ? Object : _clientupdatesservice.ClientUpdatesService,
        typeof _wsticketauthservice.WsTicketAuthService === "undefined" ? Object : _wsticketauthservice.WsTicketAuthService,
        typeof _wsapihubservice.WsApiHubService === "undefined" ? Object : _wsapihubservice.WsApiHubService
    ])
], RealtimeApiGateway);
