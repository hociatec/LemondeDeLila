"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PresenceService", {
    enumerable: true,
    get: function() {
        return PresenceService;
    }
});
const _common = require("@nestjs/common");
const _ws = require("ws");
const _crypto = require("crypto");
const _typeorm = require("@nestjs/typeorm");
const _chatservice = require("../../chat/services/chat.service");
const _chatsettingsservice = require("../../chat/services/chat-settings.service");
const _roomparticipantentity = require("../../room/entities/room-participant.entity");
const _typeorm1 = require("typeorm");
const _presencetransport = require("./presence-transport");
const _userentity = require("../../user/entities/user.entity");
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
let PresenceService = class PresenceService {
    async onModuleDestroy() {
        await this.transport.disconnect();
    }
    register(socket, user, context = 'home') {
        this.clients.set(socket, {
            socket,
            user,
            context,
            contextLocked: false,
            roomHint: null,
            lastInteractionAt: Date.now()
        });
        this.ensureHeartbeat();
    }
    unregister(socket) {
        this.clients.delete(socket);
        if (this.clients.size === 0) {
            this.stopHeartbeat();
        }
    }
    async handleClientPayload(from, raw) {
        let textPayload;
        if (typeof raw === 'string') {
            textPayload = raw;
        } else if (Buffer.isBuffer(raw)) {
            textPayload = raw.toString('utf-8');
        } else if (raw && typeof raw === 'object' && 'byteLength' in raw) {
            textPayload = Buffer.from(raw).toString('utf-8');
        } else {
            return;
        }
        if (textPayload.length > 16_384) {
            this.logger.warn('Message WS trop volumineux, rejeté');
            return;
        }
        let payload = null;
        try {
            payload = JSON.parse(textPayload);
        } catch  {
            return;
        }
        if (!payload || typeof payload.type !== 'string') {
            return;
        }
        if (payload.type === 'chat-send') {
            from.lastInteractionAt = Date.now();
            await this.handleChatSend(from, payload);
            return;
        }
        if (payload.type === 'chat-edit') {
            from.lastInteractionAt = Date.now();
            await this.handleChatEdit(from, payload);
            return;
        }
        if (payload.type === 'chat-delete') {
            from.lastInteractionAt = Date.now();
            await this.handleChatDelete(from, payload);
            return;
        }
        if (payload.type === 'presence-context') {
            from.lastInteractionAt = Date.now();
            this.handlePresenceContext(from, payload);
            this.broadcastPresence();
            return;
        }
        if (payload.type === 'presence-activity') {
            // Client-side interaction heartbeat (keyboard/mouse/touch), used for "absent" detection.
            const at = typeof payload.at === 'number' && Number.isFinite(payload.at) ? payload.at : Date.now();
            from.lastInteractionAt = at;
        // No immediate broadcast; heartbeat will refresh periodically, and other events can rebroadcast.
        }
    }
    async handleChatSend(from, payload) {
        const text = typeof payload.text === 'string' ? payload.text : '';
        try {
            // IMPORTANT: éviter le log info sur chaque message (bruyant + ajoute de la latence sur disque).
            this.logger.debug(`Chat-send reçu de ${from.user.username} (#${from.user.id})`);
            const ban = await this.getChatBan(from.user.id);
            if (ban?.until && ban.until.getTime() > Date.now()) {
                this.safeSend(from.socket, {
                    type: 'error',
                    payload: {
                        message: 'Accès au tchat refusé.',
                        reason: ban.reason ?? null,
                        until: ban.until ? ban.until.toISOString() : null
                    }
                });
                try {
                    from.socket.close(4403, 'chat banned');
                } catch  {
                /* ignore */ }
                return;
            }
        } catch (err) {
            this.logger.warn(`Message chat invalide pour ${from.user.username}: ${err?.message ?? 'inconnu'}`);
            return;
        }
        try {
            const normalized = await this.chat.recordMessageForBroadcast({
                id: from.user.id,
                username: from.user.username
            }, text);
            this.broadcastChat(normalized);
        } catch (err) {
            this.logger.warn(`Echec enregistrement/diffusion message tchat pour ${from.user.username}: ${err?.message ?? 'inconnu'}`);
            this.safeSend(from.socket, {
                type: 'error',
                payload: {
                    message: err?.message ?? 'Erreur tchat.'
                }
            });
        }
    }
    async handleChatEdit(from, payload) {
        const text = typeof payload.text === 'string' ? payload.text : '';
        const messageId = typeof payload.messageId === 'string' ? payload.messageId.trim() : '';
        if (!messageId) {
            return;
        }
        try {
            const ban = await this.getChatBan(from.user.id);
            if (ban?.until && ban.until.getTime() > Date.now()) {
                this.safeSend(from.socket, {
                    type: 'error',
                    payload: {
                        message: 'Accès au tchat refusé.',
                        reason: ban.reason ?? null,
                        until: ban.until ? ban.until.toISOString() : null
                    }
                });
                try {
                    from.socket.close(4403, 'chat banned');
                } catch  {
                /* ignore */ }
                return;
            }
        } catch  {
        // ignore ban lookup errors; best-effort
        }
        try {
            const normalized = await this.chat.editOwnMessage(from.user.id, messageId, text);
            this.broadcastChat({
                type: 'chat-message.updated',
                payload: normalized
            });
        } catch (err) {
            this.safeSend(from.socket, {
                type: 'error',
                payload: {
                    message: err?.message ?? 'Modification impossible.'
                }
            });
        }
    }
    async handleChatDelete(from, payload) {
        const messageId = typeof payload.messageId === 'string' ? payload.messageId.trim() : '';
        if (!messageId) {
            return;
        }
        try {
            const ban = await this.getChatBan(from.user.id);
            if (ban?.until && ban.until.getTime() > Date.now()) {
                this.safeSend(from.socket, {
                    type: 'error',
                    payload: {
                        message: 'Accès au tchat refusé.',
                        reason: ban.reason ?? null,
                        until: ban.until ? ban.until.toISOString() : null
                    }
                });
                try {
                    from.socket.close(4403, 'chat banned');
                } catch  {
                /* ignore */ }
                return;
            }
        } catch  {
        // ignore ban lookup errors; best-effort
        }
        try {
            const ok = await this.chat.deleteOwnMessage(from.user.id, messageId);
            if (ok) {
                this.broadcastChat({
                    type: 'chat-message.deleted',
                    payload: {
                        id: messageId
                    }
                });
            }
        } catch (err) {
            this.safeSend(from.socket, {
                type: 'error',
                payload: {
                    message: err?.message ?? 'Suppression impossible.'
                }
            });
        }
    }
    async isChatBannedNow(userId) {
        const ban = await this.getChatBan(userId);
        return !!(ban?.until && ban.until.getTime() > Date.now());
    }
    async getChatBanInfo(userId) {
        return this.getChatBan(userId);
    }
    async getChatBan(userId) {
        const cached = this.chatBanCache.get(userId);
        if (cached && Date.now() - cached.at < this.chatBanCacheTtlMs) {
            return {
                until: cached.until,
                reason: cached.reason
            };
        }
        const user = await this.users.findOne({
            where: {
                id: userId
            },
            select: [
                'id',
                'chatBannedUntil',
                'chatBanReason'
            ]
        });
        const until = user?.chatBannedUntil ?? null;
        const reason = user?.chatBanReason ?? null;
        this.chatBanCache.set(userId, {
            at: Date.now(),
            until,
            reason
        });
        return {
            until,
            reason
        };
    }
    safeSend(client, payload) {
        if (client.readyState !== _ws.WebSocket.OPEN) return;
        try {
            client.send(JSON.stringify(payload));
        } catch  {
        // ignore
        }
    }
    handlePresenceContext(client, payload) {
        const raw = typeof payload.context === 'string' ? payload.context.toLowerCase() : '';
        let context = 'home';
        if (raw === 'chat') {
            context = 'chat';
        } else if (raw === 'table') {
            context = 'table';
        } else if (raw === 'tavern') {
            context = 'tavern';
        } else if (raw === 'messaging') {
            context = 'messaging';
        } else if (raw === 'social') {
            context = 'social';
        } else if (raw === 'stats') {
            context = 'stats';
        } else if (raw === 'notifications') {
            context = 'notifications';
        } else if (raw === 'other') {
            context = 'other';
        }
        client.context = context;
        client.contextLocked = true;
        if (context === 'table') {
            const roomId = this.parseRoomId(payload.roomId);
            if (roomId !== null) {
                let name = null;
                if (typeof payload.roomName === 'string') {
                    const trimmed = payload.roomName.trim();
                    name = trimmed.length > 0 ? trimmed : null;
                }
                client.roomHint = {
                    id: roomId,
                    name
                };
            } else {
                client.roomHint = null;
            }
        } else {
            client.roomHint = null;
        }
    }
    parseRoomId(value) {
        if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            if (!Number.isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return null;
    }
    async sendHistory(to) {
        try {
            const limit = this.chatSettings.getChatHistoryLimit();
            const payload = {
                type: 'chat-history',
                editWindowSeconds: this.chatSettings.getEditWindowSeconds(),
                messages: await this.chat.getRecentNormalizedMessages(limit)
            };
            to.send(JSON.stringify(payload));
        } catch (err) {
            this.logger.error('Echec envoi historique chat', err);
            to.close();
        }
    }
    broadcastPresence() {
        const playersByUser = this.collectPlayers();
        this.attachRooms(playersByUser).then(()=>this.emitPresence(playersByUser)).catch((err)=>{
            this.logger.warn('attachRooms a échoué, diffusion présence sans room enrichie', err);
            this.emitPresence(playersByUser);
        });
    }
    /**
   * Best-effort check: true if the user has at least one active presence connection in "tavern" context.
   * Used by features that require all players to be available before starting/restoring a table.
   */ isUserInTavern(userId) {
        if (!Number.isFinite(userId) || userId <= 0) return false;
        for (const client of this.clients.values()){
            if (client?.user?.id !== userId) continue;
            if (client.context === 'tavern') return true;
        }
        return false;
    }
    collectPlayers() {
        const playersByUser = new Map();
        for (const client of this.clients.values()){
            const { user, context, roomHint, contextLocked } = client;
            const activity = context ?? 'home';
            const candidate = {
                id: user.id,
                username: user.username,
                currentRoom: roomHint ? {
                    id: roomHint.id,
                    name: roomHint.name ?? `Table #${roomHint.id}`
                } : null,
                activity,
                contextLocked,
                lastInteractionAt: client.lastInteractionAt ?? Date.now(),
                roomStarted: null
            };
            const existing = playersByUser.get(user.id);
            if (!existing) {
                playersByUser.set(user.id, candidate);
                continue;
            }
            const currentScore = this.scoreActivity(existing.activity);
            const candidateScore = this.scoreActivity(candidate.activity);
            if (candidateScore < currentScore) {
                playersByUser.set(user.id, candidate);
                continue;
            }
            if (candidateScore === currentScore) {
                existing.contextLocked = existing.contextLocked || candidate.contextLocked;
                if (!existing.currentRoom && candidate.currentRoom) {
                    existing.currentRoom = candidate.currentRoom;
                }
                if (typeof candidate.lastInteractionAt === 'number' && candidate.lastInteractionAt > (existing.lastInteractionAt ?? 0)) {
                    existing.lastInteractionAt = candidate.lastInteractionAt;
                }
            }
        }
        return playersByUser;
    }
    async attachRooms(playersByUser) {
        const userIds = Array.from(playersByUser.keys());
        if (userIds.length === 0) {
            return;
        }
        const participants = await this.participants.find({
            where: {
                leftAt: (0, _typeorm1.IsNull)(),
                user: {
                    id: (0, _typeorm1.In)(userIds)
                }
            },
            relations: [
                'room',
                'user'
            ],
            order: {
                joinedAt: 'DESC'
            }
        });
        for (const p of participants){
            const entry = playersByUser.get(p.user.id);
            if (!entry || !p.room) {
                continue;
            }
            if (entry.activity === 'chat') {
                continue;
            }
            if (entry.contextLocked && entry.activity !== 'table') {
                continue;
            }
            if (entry.currentRoom === null) {
                entry.currentRoom = {
                    id: p.room.id,
                    name: p.room.name
                };
            }
            if (!entry.contextLocked) {
                entry.activity = 'table';
            }
            // Enrich: know whether the room has started (affects availability).
            entry.roomStarted = String(p.room.status ?? '').toLowerCase() === 'started' || Boolean(p.room.startedAt);
        }
    }
    scoreActivity(activity) {
        if (activity === 'table') {
            return 0;
        }
        if (activity === 'messaging' || activity === 'social' || activity === 'notifications' || activity === 'other') {
            return 1;
        }
        if (activity === 'chat') {
            return 2;
        }
        if (activity === 'tavern' || activity === 'stats') {
            return 3;
        }
        return 4; // home (default)
    }
    broadcast(payload) {
        const encoded = JSON.stringify(payload);
        for (const { socket } of this.clients.values()){
            try {
                socket.send(encoded);
            } catch (err) {
                this.logger.warn('Envoi WS échoué', err);
                this.unregister(socket);
                try {
                    socket.close();
                } catch  {
                /* ignore */ }
            }
        }
    }
    broadcastChat(payload) {
        const encoded = JSON.stringify(payload);
        for (const { socket, context } of this.clients.values()){
            if (context !== 'chat') {
                continue;
            }
            try {
                socket.send(encoded);
            } catch (err) {
                this.logger.warn('Envoi WS échoué', err);
                this.unregister(socket);
                try {
                    socket.close();
                } catch  {
                /* ignore */ }
            }
        }
    }
    emitPresence(playersByUser) {
        const players = this.toPublicPlayers(playersByUser);
        this.playersByOrigin.set(this.instanceId, {
            at: Date.now(),
            players
        });
        this.pruneOrigins();
        const merged = this.mergePlayersFromOrigins();
        const enriched = this.enrichMergedPlayers(merged);
        this.broadcast({
            type: 'presence-update',
            players: enriched
        });
        this.transport.publish({
            players,
            origin: this.instanceId,
            at: Date.now()
        }).catch((err)=>this.logger.error('Publication presence redis échouée', err));
    }
    toPublicPlayers(playersByUser) {
        return Array.from(playersByUser.values()).map(({ contextLocked: _contextLocked, ...rest })=>rest);
    }
    handleExternalPresence(event) {
        if (event.origin === this.instanceId) {
            return;
        }
        const origin = event.origin ?? 'unknown';
        this.playersByOrigin.set(origin, {
            at: typeof event.at === 'number' && Number.isFinite(event.at) ? event.at : Date.now(),
            players: Array.isArray(event.players) ? event.players : []
        });
        this.pruneOrigins();
        const merged = this.mergePlayersFromOrigins();
        const enriched = this.enrichMergedPlayers(merged);
        this.broadcast({
            type: 'presence-update',
            players: enriched
        });
    }
    findClient(socket) {
        return this.clients.get(socket);
    }
    listPlayers() {
        this.pruneOrigins();
        const merged = this.mergePlayersFromOrigins();
        const enriched = this.enrichMergedPlayers(merged);
        return enriched.map((p)=>({
                id: p.id,
                username: p.username,
                activity: p.activity,
                currentRoom: p.currentRoom ?? null,
                lastInteractionAt: p.lastInteractionAt ?? 0,
                roomStarted: p.roomStarted ?? null,
                availability: p.availability,
                location: p.location
            }));
    }
    pruneOrigins() {
        const now = Date.now();
        for (const [origin, entry] of this.playersByOrigin.entries()){
            if (!entry || typeof entry.at !== 'number' || now - entry.at > this.originTtlMs) {
                this.playersByOrigin.delete(origin);
            }
        }
    }
    mergePlayersFromOrigins() {
        const combined = [];
        for (const entry of this.playersByOrigin.values()){
            combined.push(...entry.players ?? []);
        }
        const byUser = new Map();
        for (const p of combined){
            if (!p || typeof p.id !== 'number') continue;
            const id = p.id;
            if (!Number.isFinite(id) || id <= 0) continue;
            const candidate = {
                id,
                username: String(p.username ?? '').trim() || `user#${id}`,
                activity: String(p.activity ?? 'home') ?? 'home',
                currentRoom: p.currentRoom ?? null,
                lastInteractionAt: typeof p.lastInteractionAt === 'number' && Number.isFinite(p.lastInteractionAt) ? p.lastInteractionAt : 0,
                roomStarted: typeof p.roomStarted === 'boolean' ? p.roomStarted : null
            };
            const existing = byUser.get(id);
            if (!existing) {
                byUser.set(id, candidate);
                continue;
            }
            const currentScore = this.scoreActivity(existing.activity);
            const candidateScore = this.scoreActivity(candidate.activity);
            if (candidateScore < currentScore) {
                byUser.set(id, candidate);
                continue;
            }
            if (candidateScore === currentScore) {
                if (!existing.currentRoom && candidate.currentRoom) {
                    existing.currentRoom = candidate.currentRoom;
                }
                if (typeof candidate.lastInteractionAt === 'number' && candidate.lastInteractionAt > (existing.lastInteractionAt ?? 0)) {
                    existing.lastInteractionAt = candidate.lastInteractionAt;
                }
                if (existing.roomStarted == null && candidate.roomStarted != null) {
                    existing.roomStarted = candidate.roomStarted;
                }
            }
        }
        return Array.from(byUser.values());
    }
    enrichMergedPlayers(players) {
        const now = Date.now();
        return players.map((p)=>{
            const last = typeof p.lastInteractionAt === 'number' ? p.lastInteractionAt : 0;
            const availability = this.computeAvailability(p.activity, p.roomStarted, now, last);
            const location = this.computeLocation(p.activity, p.currentRoom);
            return {
                ...p,
                availability,
                location
            };
        });
    }
    computeAvailability(activity, roomStarted, now, lastInteractionAt) {
        if (lastInteractionAt > 0 && now - lastInteractionAt >= this.absentAfterMs) {
            return 'absent';
        }
        if (activity === 'table') {
            return roomStarted ? 'occupied' : 'available';
        }
        if (activity === 'chat' || activity === 'tavern' || activity === 'stats' || activity === 'home') {
            return 'available';
        }
        // messaging + other modules: occupied
        return 'occupied';
    }
    computeLocation(activity, currentRoom) {
        if (activity === 'table') {
            return currentRoom?.name || (currentRoom?.id ? `Table #${currentRoom.id}` : 'Table');
        }
        if (activity === 'chat') return 'tchat';
        if (activity === 'tavern') return 'taverne';
        if (activity === 'stats') return 'livre des contes';
        if (activity === 'messaging') return 'messagerie';
        if (activity === 'social') return 'social';
        if (activity === 'notifications') return 'notifications';
        if (activity === 'home') return 'accueil';
        return 'application';
    }
    ensureHeartbeat() {
        if (this.heartbeatTimer) {
            return;
        }
        this.heartbeatTimer = setInterval(()=>this.runHeartbeat(), this.pingIntervalMs);
    }
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    runHeartbeat() {
        for (const socket of Array.from(this.clients.keys())){
            if (socket.readyState !== _ws.WebSocket.OPEN) {
                this.unregister(socket);
                continue;
            }
            const pongTimeout = setTimeout(()=>{
                this.unregister(socket);
                try {
                    socket.terminate?.();
                } catch  {
                    socket.close();
                }
            }, this.pingTimeoutMs);
            try {
                socket.ping();
                socket.once('pong', ()=>clearTimeout(pongTimeout));
            } catch  {
                clearTimeout(pongTimeout);
                this.unregister(socket);
                try {
                    socket.terminate?.();
                } catch  {
                    socket.close();
                }
            }
        }
        // Periodic refresh so "absent" status propagates even without explicit events.
        if (this.clients.size > 0) {
            this.broadcastPresence();
        }
        if (this.clients.size === 0) {
            this.stopHeartbeat();
        }
    }
    constructor(chat, chatSettings, participants, users, transport){
        this.chat = chat;
        this.chatSettings = chatSettings;
        this.participants = participants;
        this.users = users;
        this.transport = transport;
        this.logger = new _common.Logger(PresenceService.name);
        this.clients = new Map();
        this.playersByOrigin = new Map();
        this.heartbeatTimer = null;
        this.pingIntervalMs = 30_000;
        this.pingTimeoutMs = 10_000;
        this.instanceId = (0, _crypto.randomUUID)();
        this.originTtlMs = 120_000;
        this.chatBanCache = new Map();
        this.chatBanCacheTtlMs = 10_000;
        this.absentAfterMs = 3 * 60_000;
        this.transport.subscribe((event)=>this.handleExternalPresence(event)).catch((err)=>this.logger.error('Impossible de souscrire aux updates presence', err));
    }
};
PresenceService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(2, (0, _typeorm.InjectRepository)(_roomparticipantentity.RoomParticipant)),
    _ts_param(3, (0, _typeorm.InjectRepository)(_userentity.User)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _chatservice.ChatService === "undefined" ? Object : _chatservice.ChatService,
        typeof _chatsettingsservice.ChatSettingsService === "undefined" ? Object : _chatsettingsservice.ChatSettingsService,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _presencetransport.PresenceTransport === "undefined" ? Object : _presencetransport.PresenceTransport
    ])
], PresenceService);
