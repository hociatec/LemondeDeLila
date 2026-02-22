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
var RoomGateway_1;
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const ws_1 = require("ws");
const room_service_1 = require("../services/room.service");
const bot_service_1 = require("../../bot/services/bot.service");
const common_1 = require("@nestjs/common");
const ws_jwt_auth_service_1 = require("../../common/ws/ws-jwt-auth.service");
const catalog_service_1 = require("../../catalog/services/catalog.service");
const perf_metrics_service_1 = require("../../common/services/perf-metrics.service");
const room_invite_service_1 = require("../services/room-invite.service");
const client_updates_service_1 = require("../../client-updates/services/client-updates.service");
const version_utils_1 = require("../../common/utils/version.utils");
const ws_ticket_auth_service_1 = require("../../common/ws/ws-ticket-auth.service");
const room_realtime_tracker_service_1 = require("../services/room-realtime-tracker.service");
const room_ws_params_1 = require("./room-ws-params");
const room_roster_1 = require("./room-roster");
let RoomGateway = RoomGateway_1 = class RoomGateway {
    roomsService;
    botService;
    auth;
    catalog;
    perf;
    invites;
    clientUpdates;
    wsTickets;
    realtimeTracker;
    server;
    clients = new Map();
    rooms = new Map();
    silentRooms = new Map();
    logger = new common_1.Logger(RoomGateway_1.name);
    heartbeats = new Map();
    lastPong = new WeakMap();
    pingIntervalMs = 25_000;
    lastChatSentAt = new WeakMap();
    messageQueueByClient = new WeakMap();
    roomChat = new Map();
    roomChatLimit = 120;
    chatCooldownMs = 350;
    chatMaxLength = 300;
    lastRoomStatusByRoomId = new Map();
    participantDisconnectGraceMs = 60_000;
    pendingParticipantLeaves = new Map();
    constructor(roomsService, botService, auth, catalog, perf, invites, clientUpdates, wsTickets, realtimeTracker) {
        this.roomsService = roomsService;
        this.botService = botService;
        this.auth = auth;
        this.catalog = catalog;
        this.perf = perf;
        this.invites = invites;
        this.clientUpdates = clientUpdates;
        this.wsTickets = wsTickets;
        this.realtimeTracker = realtimeTracker;
        this.roomsService.setRealtimeNotifier(async (roomId) => {
            await this.broadcast(roomId, 'state-updated', { roomId });
            await this.sendRoomState(roomId);
        });
        this.roomsService.setRoomDeletedNotifier(async (roomId) => {
            this.roomChat.delete(roomId);
            this.forceDisconnectRoomClients(roomId);
        });
    }
    forceDisconnectRoomClients(roomId) {
        const targets = this.rooms.get(roomId);
        const silentTargets = this.silentRooms.get(roomId);
        const socketSet = new Set();
        if (targets) {
            for (const socket of targets)
                socketSet.add(socket);
        }
        if (silentTargets) {
            for (const socket of silentTargets)
                socketSet.add(socket);
        }
        for (const [socket, meta] of this.clients.entries()) {
            if (meta?.roomId === roomId) {
                socketSet.add(socket);
            }
        }
        const all = Array.from(socketSet);
        const deletedMessage = JSON.stringify({ type: 'room.deleted', roomId });
        for (const socket of all) {
            this.realtimeTracker.clearSocket(socket);
            this.clients.delete(socket);
            targets?.delete(socket);
            silentTargets?.delete(socket);
            try {
                if (socket.readyState === ws_1.WebSocket.OPEN) {
                    socket.send(deletedMessage, () => {
                        try {
                            socket.close();
                        }
                        catch {
                        }
                    });
                }
                else {
                    socket.close();
                }
            }
            catch {
            }
        }
        if (targets?.size === 0)
            this.rooms.delete(roomId);
        if (silentTargets?.size === 0)
            this.silentRooms.delete(roomId);
    }
    async handleConnection(client, ...args) {
        if (!this.wsTickets.validate(client, args, 'room')) {
            this.logger.warn('Connexion WS refusée: ticket manquant ou invalide.');
            client.close(4403, 'ws ticket requis');
            return;
        }
        const clientVersion = this.auth.extractClientVersion(client, args);
        const minRequired = await this.clientUpdates.getMinRequiredVersion();
        if (minRequired) {
            const outdated = !clientVersion || (0, version_utils_1.isVersionLower)(clientVersion, minRequired) === true;
            if (outdated) {
                client.close(4406, 'update required');
                return;
            }
        }
        const { token, roomId, spectator, silent } = (0, room_ws_params_1.extractRoomWsParams)(client, args);
        const payload = this.auth.tryVerify(token);
        if (!payload?.id) {
            client.close(4001, 'auth required');
            return;
        }
        const isAdmin = this.isAdmin(payload.roles);
        let targetRoomId = roomId && roomId > 0 ? roomId : 0;
        if (targetRoomId > 0) {
            this.clearPendingParticipantLeave(targetRoomId, payload.id);
            const effectiveSilent = Boolean(silent);
            if (this.roomsService.isBanned(targetRoomId, payload.id)) {
                await this.sendError(client, 'Banni de cette table.');
                targetRoomId = 0;
            }
            if (effectiveSilent && !isAdmin) {
                client.close(4003, 'Mode caché réservé aux admins');
                return;
            }
            let role = spectator || effectiveSilent ? 'spectator' : 'participant';
            if (role === 'spectator' && !effectiveSilent) {
                try {
                    await this.roomsService.leaveAllRoomsForUser(payload.id, {
                        exceptRoomId: targetRoomId,
                    });
                }
                catch {
                }
                const allowed = await this.canSpectate(targetRoomId, payload.id);
                if (!allowed) {
                    client.close(4003, 'Spectateur non autorise sur cette table');
                    return;
                }
                try {
                    const state = await this.roomsService.getRoomPayload(targetRoomId);
                    const isOwner = state.room.owner?.id === payload.id;
                    const started = (state.room.status || '').toLowerCase() === 'started' ||
                        Boolean(state.room.startedAt);
                    if (!started && (!state.room.isPrivate || isOwner)) {
                        await this.roomsService.leaveRoom(targetRoomId, payload.id, {
                            preserveRoom: true,
                            preserveOwner: isOwner,
                        });
                    }
                }
                catch {
                }
            }
            else if (role !== 'spectator') {
                try {
                    await this.roomsService.joinRoom(targetRoomId, payload.id);
                }
                catch (err) {
                    const reason = err.message;
                    try {
                        const state = await this.roomsService.getRoomPayload(targetRoomId);
                        const isOwner = state.room.owner?.id === payload.id;
                        const isParticipant = state.room.players?.some((p) => p?.id === payload.id) ?? false;
                        const isPrivate = Boolean(state.room.isPrivate);
                        const started = (state.room.status || '').toLowerCase() === 'started' ||
                            Boolean(state.room.startedAt);
                        if (!isOwner && !isParticipant) {
                            if (started) {
                                try {
                                    await this.roomsService.leaveAllRoomsForUser(payload.id, {
                                        exceptRoomId: targetRoomId,
                                    });
                                }
                                catch {
                                }
                                const allowed = await this.canSpectate(targetRoomId, payload.id);
                                if (allowed) {
                                    role = 'spectator';
                                }
                                else {
                                    await this.sendError(client, reason);
                                    client.close(4003, reason);
                                    return;
                                }
                            }
                            else if (!isPrivate) {
                                role = 'spectator';
                            }
                            else {
                                await this.sendError(client, reason);
                                client.close(4003, reason);
                                return;
                            }
                        }
                    }
                    catch {
                        await this.sendError(client, reason);
                        client.close(4003, reason);
                        return;
                    }
                }
            }
            this.clients.set(client, {
                socket: client,
                userId: payload.id,
                username: payload.username,
                roomId: targetRoomId,
                role,
                silent: effectiveSilent,
                isAdmin,
            });
        }
        if (!this.clients.has(client)) {
            this.clients.set(client, {
                socket: client,
                userId: payload.id,
                username: payload.username,
                roomId: targetRoomId,
                role: 'participant',
                silent: false,
                isAdmin,
            });
        }
        const initialMeta = this.clients.get(client);
        if (initialMeta?.silent) {
            if (!this.silentRooms.has(targetRoomId)) {
                this.silentRooms.set(targetRoomId, new Set());
            }
            this.silentRooms.get(targetRoomId).add(client);
        }
        else {
            if (!this.rooms.has(targetRoomId)) {
                this.rooms.set(targetRoomId, new Set());
            }
            this.rooms.get(targetRoomId).add(client);
        }
        this.realtimeTracker.setSocketParticipantRoom(client, initialMeta?.role === 'participant' && initialMeta?.silent !== true
            ? initialMeta.roomId
            : null);
        this.lastPong.set(client, Date.now());
        client.on('pong', () => this.lastPong.set(client, Date.now()));
        const hb = setInterval(() => {
            try {
                if (client.readyState !== ws_1.WebSocket.OPEN) {
                    clearInterval(hb);
                    this.heartbeats.delete(client);
                    return;
                }
                const last = this.lastPong.get(client) ?? Date.now();
                if (Date.now() - last > this.pingIntervalMs * 2) {
                    clearInterval(hb);
                    this.heartbeats.delete(client);
                    try {
                        client.terminate?.();
                    }
                    catch {
                        try {
                            client.close();
                        }
                        catch {
                        }
                    }
                    return;
                }
                client.ping?.();
            }
            catch {
            }
        }, this.pingIntervalMs);
        this.heartbeats.set(client, hb);
        client.on('message', (raw) => this.handleMessage(client, raw));
        client.on('error', () => client.close());
        if (targetRoomId > 0) {
            if (initialMeta?.silent) {
                await this.sendRoomStateToClient(client, targetRoomId, {
                    includeRealtimePlayers: true,
                    includeHiddenSelf: {
                        userId: initialMeta.userId,
                        username: initialMeta.username,
                    },
                });
            }
            else {
                await this.sendRoomState(targetRoomId);
            }
            await this.sendChatHistoryToClient(client, targetRoomId);
        }
    }
    async handleDisconnect(client) {
        const meta = this.clients.get(client);
        this.realtimeTracker.clearSocket(client);
        this.clients.delete(client);
        this.messageQueueByClient.delete(client);
        const hb = this.heartbeats.get(client);
        if (hb) {
            clearInterval(hb);
            this.heartbeats.delete(client);
        }
        let roomStarted = false;
        let ownerId = null;
        if (meta && meta.roomId > 0) {
            try {
                const state = await this.roomsService.getRoomPayload(meta.roomId);
                ownerId = state?.room?.owner?.id ?? null;
                roomStarted =
                    (state?.room?.status || '').toLowerCase() === 'started' ||
                        Boolean(state?.room?.startedAt);
            }
            catch {
                roomStarted = null;
            }
        }
        if (meta) {
            const set = this.rooms.get(meta.roomId);
            let remainingConnections = 0;
            if (set) {
                set.delete(client);
                if (set.size === 0) {
                    this.rooms.delete(meta.roomId);
                    remainingConnections = 0;
                }
                else {
                    remainingConnections = set.size;
                }
            }
            const silentSet = this.silentRooms.get(meta.roomId);
            let remainingSilentConnections = 0;
            if (silentSet) {
                silentSet.delete(client);
                if (silentSet.size === 0) {
                    this.silentRooms.delete(meta.roomId);
                    remainingSilentConnections = 0;
                }
                else {
                    remainingSilentConnections = silentSet.size;
                }
            }
            const remainingTotalConnections = remainingConnections + remainingSilentConnections;
            const userStillConnected = this.hasUserConnections(meta.roomId, meta.userId);
            if (meta.role === 'participant') {
                if (!userStillConnected) {
                    const disconnectOnly = true;
                    this.roomsService
                        .leaveRoom(meta.roomId, meta.userId, {
                        preserveRoom: true,
                        disconnectOnly,
                    })
                        .catch(() => { });
                    if (roomStarted === true) {
                        this.scheduleDelayedParticipantLeave(meta.roomId, meta.userId);
                    }
                }
            }
            else {
                if (!userStillConnected && ownerId === meta.userId) {
                    this.roomsService
                        .transferOwnerIfCurrent(meta.roomId, meta.userId)
                        .catch(() => { });
                }
                if (remainingTotalConnections === 0) {
                    this.roomsService
                        .leaveRoom(meta.roomId, meta.userId, {
                        preserveRoom: false,
                        disconnectOnly: false,
                    })
                        .catch(() => { });
                }
            }
            if (meta.roomId > 0 && meta.silent !== true) {
                this.sendRoomState(meta.roomId).catch(() => { });
            }
        }
    }
    async handleMessage(client, raw) {
        await this.enqueueClientMessage(client, async () => {
            const meta = this.clients.get(client);
            if (!meta) {
                client.close();
                return;
            }
            try {
                const parsed = this.decode(raw);
                if (!parsed)
                    return;
                await this.handleCommand(client, meta, parsed);
            }
            catch (err) {
                await this.sendError(client, err.message || 'Erreur temps réel');
            }
        });
    }
    enqueueClientMessage(client, fn) {
        const prev = this.messageQueueByClient.get(client) ?? Promise.resolve();
        const next = prev.then(fn, fn);
        this.messageQueueByClient.set(client, next.catch(() => { }));
        return next;
    }
    async sendRoomState(roomId) {
        try {
            let payload = await this.roomsService.getRoomPayload(roomId);
            const previousStatus = (this.lastRoomStatusByRoomId.get(roomId) ?? '')
                .toLowerCase()
                .trim();
            const nextStatus = String(payload?.room?.status ?? '')
                .toLowerCase()
                .trim();
            if (previousStatus === 'started' &&
                nextStatus &&
                nextStatus !== 'started') {
                await this.promoteConnectedSpectatorsToParticipants(roomId);
                await this.roomsService.invalidateRoomPayloadCache(roomId);
                payload = await this.roomsService.getRoomPayload(roomId);
            }
            this.lastRoomStatusByRoomId.set(roomId, nextStatus);
            this.applySpectators(roomId, payload);
            await this.broadcast(roomId, 'room.updated', payload);
        }
        catch {
        }
    }
    applySpectators(roomId, payload) {
        payload.room.spectators = (0, room_roster_1.listVisibleSpectators)(this.clients.values(), roomId);
        payload.room.counts.spectators = payload.room.spectators.length;
        const started = (payload.room.status || '').toLowerCase() === 'started' ||
            Boolean(payload.room.startedAt);
        if (!started &&
            payload.room.players?.length &&
            payload.room.spectators?.length) {
            const spectatorIds = new Set(payload.room.spectators.map((s) => s.id));
            payload.room.players = payload.room.players.filter((p) => !spectatorIds.has(p.id));
            payload.room.counts.players = payload.room.players.length;
        }
        if (payload.room.players?.length && payload.room.spectators?.length) {
            const playerIds = new Set(payload.room.players.map((p) => p.id));
            payload.room.spectators = payload.room.spectators.filter((s) => !playerIds.has(s.id));
            payload.room.counts.spectators = payload.room.spectators.length;
        }
    }
    async broadcastRoomPayload(roomId, payload) {
        this.applySpectators(roomId, payload);
        await this.broadcast(roomId, 'room.updated', payload);
    }
    async tryUpdateRoomPayload(roomId, updater) {
        const updated = await this.roomsService.updateRoomPayloadCache(roomId, updater);
        if (!updated) {
            return false;
        }
        await this.broadcastRoomPayload(roomId, updated);
        return true;
    }
    async sendRoomStateToClient(client, roomId, opts) {
        try {
            const payload = await this.roomsService.getRoomPayload(roomId);
            this.applySpectators(roomId, payload);
            if (opts?.includeHiddenSelf) {
                payload.room.spectators = (0, room_roster_1.addHiddenSelf)(payload.room.spectators, opts.includeHiddenSelf);
                payload.room.counts.spectators = payload.room.spectators.length;
            }
            if (opts?.includeRealtimePlayers) {
                const connected = (0, room_roster_1.listConnectedPlayers)(this.clients.values(), roomId);
                payload.room.players = (0, room_roster_1.mergePlayers)(payload.room.players, connected);
                payload.room.counts.players = payload.room.players.length;
            }
            this.safeSend(client, { type: 'room.updated', roomId, payload });
        }
        catch (err) {
            await this.sendError(client, err.message || 'Erreur table');
            try {
                client.close(4003, 'room not found');
            }
            catch {
            }
        }
    }
    async broadcast(roomId, type, payload, emittedRoomId) {
        const message = JSON.stringify({
            type,
            roomId: emittedRoomId ?? roomId,
            payload,
        });
        const targets = this.rooms.get(roomId);
        const silentTargets = this.silentRooms.get(roomId);
        const sendToSet = (set) => {
            if (!set)
                return;
            for (const socket of Array.from(set)) {
                if (socket.readyState !== ws_1.WebSocket.OPEN) {
                    set.delete(socket);
                    continue;
                }
                try {
                    socket.send(message);
                }
                catch {
                    set.delete(socket);
                    try {
                        socket.close();
                    }
                    catch {
                    }
                }
            }
            if (set.size === 0) {
                if (set === targets)
                    this.rooms.delete(roomId);
                if (set === silentTargets)
                    this.silentRooms.delete(roomId);
            }
        };
        sendToSet(targets);
        sendToSet(silentTargets);
    }
    async sendError(client, message) {
        if (client.readyState !== ws_1.WebSocket.OPEN)
            return;
        client.send(JSON.stringify({ type: 'error', payload: { message } }));
    }
    safeSend(client, payload) {
        if (client.readyState !== ws_1.WebSocket.OPEN) {
            return;
        }
        try {
            client.send(JSON.stringify(payload));
        }
        catch {
            try {
                client.close();
            }
            catch {
            }
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
            const parsed = JSON.parse(text);
            return parsed;
        }
        catch {
            return null;
        }
    }
    async handleCommand(client, meta, payload) {
        const type = payload?.type;
        const data = payload?.payload ?? {};
        const receivedAtMs = Date.now();
        const trace = this.extractTraceMeta(data, receivedAtMs);
        if (type === 'room.start' ||
            type === 'room.reset' ||
            type === 'bot.add' ||
            type === 'bot.remove' ||
            type === 'room.toggle-privacy' ||
            type === 'room.kick' ||
            type === 'room.ban' ||
            type === 'room.set-owner' ||
            type === 'room.set-ambience') {
            this.safeSend(client, {
                type: 'room.ack',
                roomId: meta.roomId,
                payload: {
                    action: type,
                    traceId: trace.traceId,
                    receivedAtMs,
                    clientToServerMs: trace.clientToServerMs,
                },
            });
        }
        switch (type) {
            case 'room.leave':
                await this.handleRoomLeave(client, meta);
                break;
            case 'room.chat.send':
                await this.handleChatSend(client, meta, data);
                break;
            case 'room.chat.history':
                await this.handleChatHistory(client, meta);
                break;
            case 'room.start':
                await this.handleRoomStart(meta, data, receivedAtMs);
                break;
            case 'room.reset':
                await this.handleRoomReset(meta, data, receivedAtMs);
                break;
            case 'room.set-role':
                await this.handleSetRole(client, meta, data);
                break;
            case 'room.kick':
                await this.handleKickOrBan(meta, data, false);
                break;
            case 'room.ban':
                await this.handleKickOrBan(meta, data, true);
                break;
            case 'room.set-owner':
                await this.handleSetOwner(meta, data);
                break;
            case 'room.set-ambience':
                await this.handleSetAmbience(client, meta, data, receivedAtMs);
                break;
            case 'room.toggle-privacy':
                await this.handleTogglePrivacy(meta, data, receivedAtMs);
                break;
            case 'room.info':
                await this.handleRoomInfo(client, meta);
                break;
            case 'room.ping':
                this.safeSend(client, {
                    type: 'room.pong',
                    roomId: meta.roomId,
                    payload: {
                        serverTimeMs: Date.now(),
                        clientSentAtMs: typeof data?.clientSentAtMs === 'number'
                            ? data.clientSentAtMs
                            : (data?._trace?.sentAtMs ?? null),
                    },
                });
                break;
            case 'bot.add':
                await this.handleBotAdd(meta, data, receivedAtMs);
                break;
            case 'bot.remove':
                await this.handleBotRemove(meta, data, receivedAtMs);
                break;
            case 'room.create':
                await this.handleRoomCreate(client, meta, data, receivedAtMs);
                break;
            case 'room.join':
                await this.handleRoomJoin(client, meta, data, receivedAtMs);
                break;
            default:
                break;
        }
    }
    async sendChatHistoryToClient(client, roomId) {
        try {
            const enabled = await this.isRoomChatEnabled(roomId);
            if (!enabled)
                return;
            const state = this.getRoomChatState(roomId);
            if (state.messages.length === 0)
                return;
            this.safeSend(client, {
                type: 'room.chat.history',
                roomId,
                payload: { messages: state.messages },
            });
        }
        catch {
        }
    }
    getRoomChatState(roomId) {
        const existing = this.roomChat.get(roomId);
        if (existing)
            return existing;
        const created = { nextSeq: 1, messages: [] };
        this.roomChat.set(roomId, created);
        return created;
    }
    normalizeChatMessage(raw) {
        if (typeof raw !== 'string')
            return '';
        const trimmed = raw.replace(/\r?\n/g, ' ').trim();
        if (!trimmed)
            return '';
        if (trimmed.length <= this.chatMaxLength)
            return trimmed;
        return trimmed.slice(0, this.chatMaxLength).trim();
    }
    async isRoomChatEnabled(roomId) {
        try {
            const payload = await this.roomsService.getRoomPayload(roomId);
            return payload?.manifest?.chatEnabled !== false;
        }
        catch {
            return false;
        }
    }
    async handleChatHistory(client, meta) {
        if (!meta.roomId || meta.roomId <= 0) {
            await this.sendError(client, 'Vous n’êtes pas dans une table.');
            return;
        }
        await this.sendChatHistoryToClient(client, meta.roomId);
    }
    async handleChatSend(client, meta, data) {
        if (!meta.roomId || meta.roomId <= 0) {
            await this.sendError(client, 'Vous n’êtes pas dans une table.');
            return;
        }
        const enabled = await this.isRoomChatEnabled(meta.roomId);
        if (!enabled) {
            await this.sendError(client, 'Chat désactivé pour ce jeu.');
            return;
        }
        const now = Date.now();
        const lastAt = this.lastChatSentAt.get(client) ?? 0;
        if (now - lastAt < this.chatCooldownMs) {
            await this.sendError(client, 'Trop rapide. Attendez un instant.');
            return;
        }
        this.lastChatSentAt.set(client, now);
        const message = this.normalizeChatMessage(data?.message);
        if (!message) {
            return;
        }
        const state = this.getRoomChatState(meta.roomId);
        const chatMessage = {
            seq: state.nextSeq++,
            userId: meta.userId,
            username: meta.username,
            message,
            createdAt: new Date().toISOString(),
        };
        state.messages.push(chatMessage);
        while (state.messages.length > this.roomChatLimit) {
            state.messages.shift();
        }
        await this.broadcast(meta.roomId, 'room.chat.message', chatMessage);
    }
    extractTraceMeta(payload, receivedAtMs) {
        const traceId = payload && typeof payload === 'object'
            ? payload?._trace?.id
            : undefined;
        const sentAtMs = payload && typeof payload === 'object'
            ? payload?._trace?.sentAtMs
            : undefined;
        const id = typeof traceId === 'string' && traceId.trim().length > 0
            ? traceId.trim()
            : null;
        const c2s = typeof sentAtMs === 'number' && Number.isFinite(sentAtMs)
            ? Math.max(0, receivedAtMs - sentAtMs)
            : null;
        return { traceId: id, clientToServerMs: c2s };
    }
    async handleRoomInfo(client, meta) {
        const roomId = meta.roomId;
        if (!Number.isFinite(roomId) || roomId <= 0) {
            return;
        }
        const state = await this.roomsService.getRoomPayload(roomId);
        state.room.spectators = (0, room_roster_1.listVisibleSpectators)(this.clients.values(), roomId);
        state.room.counts.spectators = state.room.spectators.length;
        const gameName = state.manifest?.name || state.room.gameType || 'Jeu';
        const visibility = state.room.isPrivate ? 'privée' : 'publique';
        const mode = meta.role === 'spectator' ? 'spectateur' : 'joueur';
        const players = state.room.counts.players || state.room.players?.length || 0;
        const spectators = state.room.counts.spectators || state.room.spectators?.length || 0;
        const bots = state.room.bots?.length || 0;
        const total = players + spectators + bots;
        const peopleLabel = total === 1 ? 'personne' : 'personnes';
        const message = `${gameName}. Table ${visibility}. Mode ${mode}. ${total} ${peopleLabel} sur la table.`;
        this.safeSend(client, {
            type: 'room.info',
            roomId,
            payload: { message },
        });
    }
    async handleRoomLeave(client, meta) {
        const roomId = meta.roomId;
        if (!Number.isFinite(roomId) || roomId <= 0) {
            return;
        }
        this.realtimeTracker.setSocketParticipantRoom(client, null);
        const userId = meta.userId;
        const wasParticipant = meta.role === 'participant';
        const activeSet = meta.silent
            ? this.silentRooms.get(roomId)
            : this.rooms.get(roomId);
        let remainingInActiveSet = 0;
        if (activeSet) {
            activeSet.delete(client);
            if (activeSet.size === 0) {
                if (meta.silent) {
                    this.silentRooms.delete(roomId);
                }
                else {
                    this.rooms.delete(roomId);
                }
                remainingInActiveSet = 0;
            }
            else {
                remainingInActiveSet = activeSet.size;
            }
        }
        const otherSet = meta.silent
            ? this.rooms.get(roomId)
            : this.silentRooms.get(roomId);
        const remainingInOtherSet = otherSet?.size ?? 0;
        const remainingTotalConnections = remainingInActiveSet + remainingInOtherSet;
        const userStillConnected = this.hasUserConnections(roomId, userId);
        meta.role = 'spectator';
        meta.roomId = 0;
        meta.silent = false;
        let leftPayload = null;
        try {
            leftPayload = await this.roomsService.getRoomPayload(roomId);
            this.applySpectators(roomId, leftPayload);
            this.safeSend(client, {
                type: 'room.left',
                roomId,
                payload: leftPayload,
            });
        }
        catch {
            this.safeSend(client, { type: 'room.deleted', roomId });
        }
        (async () => {
            try {
                if (wasParticipant) {
                    await this.roomsService.leaveRoom(roomId, userId, {
                        preserveRoom: remainingTotalConnections > 0,
                        disconnectOnly: false,
                    });
                }
                else {
                    if (!userStillConnected) {
                        await this.roomsService.transferOwnerIfCurrent(roomId, userId);
                    }
                    if (remainingTotalConnections === 0) {
                        await this.roomsService.leaveRoom(roomId, userId, {
                            preserveRoom: false,
                            disconnectOnly: false,
                        });
                    }
                }
            }
            catch {
            }
            try {
                if (remainingTotalConnections > 0) {
                    await this.sendRoomState(roomId);
                }
            }
            catch {
            }
        })().catch(() => { });
    }
    async handleRoomStart(meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.start.total', async () => {
            const room = await this.roomsService.startRoom(meta.roomId, meta.userId, false);
            await this.broadcast(meta.roomId, 'state-updated', {
                roomId: meta.roomId,
            });
            const updated = await this.tryUpdateRoomPayload(meta.roomId, (payload) => {
                payload.room.status = room.status;
                payload.room.startedAt = room.startedAt
                    ? room.startedAt.toISOString()
                    : null;
                payload.room.runId =
                    typeof room.runId === 'number'
                        ? room.runId
                        : null;
                payload.generatedAt = new Date().toISOString();
                return payload;
            });
            if (!updated) {
                await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
                await this.sendRoomState(meta.roomId);
            }
        }, { roomId: meta.roomId, userId: meta.userId, ...trace });
    }
    async handleRoomReset(meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.reset.total', async () => {
            await this.roomsService.resetRoom(meta.roomId, meta.userId, false);
            await this.promoteConnectedSpectatorsToParticipants(meta.roomId);
            await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
            await this.broadcast(meta.roomId, 'state-updated', {
                roomId: meta.roomId,
            });
            await this.sendRoomState(meta.roomId);
        }, { roomId: meta.roomId, userId: meta.userId, ...trace });
    }
    async promoteConnectedSpectatorsToParticipants(roomId) {
        if (!Number.isFinite(roomId) || roomId <= 0) {
            return;
        }
        let isPrivate = false;
        try {
            const state = await this.roomsService.getRoomPayload(roomId);
            isPrivate = Boolean(state?.room?.isPrivate);
        }
        catch {
            isPrivate = false;
        }
        const connected = Array.from(this.clients.entries())
            .map(([socket, meta]) => ({ socket, meta }))
            .filter(({ meta }) => meta.roomId === roomId)
            .filter(({ meta }) => meta.silent !== true)
            .filter(({ meta }) => meta.role === 'spectator');
        for (const { socket, meta } of connected) {
            try {
                await this.roomsService.joinRoom(roomId, meta.userId, {
                    allowPrivate: isPrivate,
                });
            }
            catch {
                continue;
            }
            meta.role = 'participant';
            this.realtimeTracker.setSocketParticipantRoom(socket, roomId);
            try {
                this.safeSend(socket, {
                    type: 'room.role',
                    roomId,
                    payload: {
                        spectator: false,
                        message: 'Mode spectateur désactivé.',
                    },
                });
            }
            catch {
            }
        }
    }
    async handleTogglePrivacy(meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.togglePrivacy.total', async () => {
            const room = await this.roomsService.togglePrivacy(meta.roomId, meta.userId, false);
            let state = await this.roomsService.updateRoomPayloadCache(meta.roomId, (payload) => {
                payload.room.isPrivate = room.isPrivate;
                payload.generatedAt = new Date().toISOString();
                return payload;
            });
            if (!state) {
                await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
                state = await this.roomsService.getRoomPayload(meta.roomId);
            }
            await this.broadcast(meta.roomId, 'room.privacy', {
                isPrivate: state.room.isPrivate,
                room: state.room,
            });
        }, { roomId: meta.roomId, userId: meta.userId, ...trace });
    }
    async handleBotAdd(meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.bot.add.total', async () => {
            const bot = await this.botService.addBot(meta.roomId, meta.userId);
            await this.broadcast(meta.roomId, 'bot.added', {
                roomId: meta.roomId,
                bot: { id: bot.id, name: bot.name },
            });
            const updated = await this.tryUpdateRoomPayload(meta.roomId, (payload) => {
                payload.room.bots = payload.room.bots ?? [];
                if (!payload.room.bots.some((b) => b.id === bot.id)) {
                    payload.room.bots.push({ id: bot.id, name: bot.name });
                }
                payload.generatedAt = new Date().toISOString();
                return payload;
            });
            if (!updated) {
                await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
                await this.sendRoomState(meta.roomId);
            }
        }, { roomId: meta.roomId, userId: meta.userId, ...trace });
    }
    async handleBotRemove(meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.bot.remove.total', async () => {
            let botId = Number(payload?.botId ?? payload?.id ?? -1);
            if (!Number.isFinite(botId) || botId <= 0) {
                const last = await this.botService.getLastBotForRoom(meta.roomId);
                if (!last?.id) {
                    throw new Error('Aucun bot à retirer');
                }
                botId = Number(last.id);
            }
            const bot = await this.botService.removeBot(meta.roomId, meta.userId, botId);
            await this.broadcast(meta.roomId, 'bot.removed', {
                roomId: meta.roomId,
                bot: { id: bot.id, name: bot.name },
                botId,
            });
            const updated = await this.tryUpdateRoomPayload(meta.roomId, (payload) => {
                payload.room.bots = (payload.room.bots ?? []).filter((b) => b.id !== bot.id);
                payload.generatedAt = new Date().toISOString();
                return payload;
            });
            if (!updated) {
                await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
                await this.sendRoomState(meta.roomId);
            }
        }, { roomId: meta.roomId, userId: meta.userId, ...trace });
    }
    async handleSetRole(client, meta, payload) {
        const roomIdRaw = payload?.roomId ?? meta.roomId;
        const roomId = Number(roomIdRaw);
        if (!Number.isFinite(roomId) || roomId <= 0) {
            throw new Error('roomId invalide');
        }
        if (roomId !== meta.roomId) {
            throw new Error('roomId ne correspond pas à la table courante');
        }
        const state = await this.roomsService.getRoomPayload(meta.roomId);
        const status = (state?.room?.status || '').toLowerCase();
        if (status === 'started') {
            throw new Error('Partie déjà commencée');
        }
        const isOwner = state.room.owner?.id === meta.userId;
        const spectatorRaw = payload?.spectator;
        const spectator = spectatorRaw === true ||
            spectatorRaw === 1 ||
            spectatorRaw === '1' ||
            spectatorRaw === 'true' ||
            spectatorRaw === 'yes' ||
            spectatorRaw === 'y';
        if (spectator) {
            if (!state.room.isPrivate || isOwner) {
                await this.roomsService.leaveRoom(meta.roomId, meta.userId, {
                    preserveRoom: true,
                    preserveOwner: isOwner,
                });
            }
            meta.role = 'spectator';
        }
        else {
            if (state.room.isPrivate) {
                if (isOwner) {
                    await this.roomsService.joinRoom(meta.roomId, meta.userId, {
                        allowPrivate: true,
                    });
                }
                else {
                    const isParticipant = state.room.players?.some((p) => p?.id === meta.userId) ?? false;
                    if (!isParticipant) {
                        throw new Error('Table privée: invitation requise');
                    }
                }
            }
            else {
                await this.roomsService.joinRoom(meta.roomId, meta.userId);
            }
            meta.role = 'participant';
        }
        this.realtimeTracker.setSocketParticipantRoom(client, meta.role === 'participant' ? meta.roomId : null);
        this.safeSend(client, {
            type: 'room.role',
            roomId: meta.roomId,
            payload: {
                spectator,
                message: spectator
                    ? 'Mode spectateur activé.'
                    : 'Mode spectateur désactivé.',
            },
        });
        await this.sendRoomState(meta.roomId);
    }
    async handleRoomCreate(client, meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.create.total', async () => {
            const gameType = typeof payload?.gameType === 'string' ? payload.gameType : '';
            const name = typeof payload?.name === 'string' ? payload.name : null;
            const maxPlayersRaw = payload?.maxPlayers ?? payload?.max ?? null;
            const maxPlayers = typeof maxPlayersRaw === 'number'
                ? maxPlayersRaw
                : Number.isFinite(parseInt(maxPlayersRaw, 10))
                    ? parseInt(maxPlayersRaw, 10)
                    : null;
            const isPrivate = typeof payload?.isPrivate === 'boolean' ? payload.isPrivate : false;
            const room = await this.roomsService.createRoom(meta.userId, gameType, name, maxPlayers, isPrivate, false);
            const previousRoomId = meta.roomId;
            const previousRole = meta.role;
            if (previousRoomId !== room.id) {
                const previousSet = this.rooms.get(previousRoomId);
                if (previousSet) {
                    previousSet.delete(client);
                    if (previousSet.size === 0) {
                        this.rooms.delete(previousRoomId);
                    }
                }
                if (!this.rooms.has(room.id)) {
                    this.rooms.set(room.id, new Set());
                }
                this.rooms.get(room.id).add(client);
            }
            meta.roomId = room.id;
            meta.role = 'participant';
            this.realtimeTracker.setSocketParticipantRoom(client, room.id);
            const manifest = await this.catalog.getGame(room.gameType);
            const state = {
                manifest: manifest
                    ? {
                        id: manifest.id,
                        name: manifest.name,
                        minPlayers: manifest.minPlayers ?? 2,
                        maxPlayers: manifest.maxPlayers ?? room.maxPlayers,
                        chatEnabled: manifest.chatEnabled !== false,
                        chatSoundsEnabled: manifest.chatSoundsEnabled !== false,
                    }
                    : null,
                room: {
                    id: room.id,
                    name: room.name,
                    isPrivate: room.isPrivate,
                    maxPlayers: room.maxPlayers,
                    status: room.status,
                    gameType: room.gameType,
                    startedAt: room.startedAt ? room.startedAt.toISOString() : null,
                    counts: { players: 1, spectators: 0 },
                    owner: { id: meta.userId, username: meta.username },
                    players: [
                        {
                            id: meta.userId,
                            username: meta.username,
                        },
                    ],
                    spectators: [],
                    bots: [],
                },
                generatedAt: new Date().toISOString(),
            };
            const message = {
                type: 'room.created',
                roomId: room.id,
                payload: state,
            };
            if (previousRoomId > 0) {
                await this.broadcast(previousRoomId, message.type, message.payload ?? state, room.id);
            }
            if (previousRoomId > 0 && previousRoomId !== room.id) {
                await this.leavePreviousRoomOnSwitch(previousRoomId, meta.userId, previousRole);
            }
            await this.roomsService.primeRoomPayloadCache(room.id, state);
            this.safeSend(client, message);
            await this.broadcastRoomPayload(room.id, state);
        }, {
            userId: meta.userId,
            roomId: meta.roomId,
            gameType: payload?.gameType ?? null,
            ...trace,
        });
    }
    async handleRoomJoin(client, meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.join.total', async () => {
            const roomId = Number(payload?.roomId ?? payload?.room ?? 0);
            const spectatorRaw = payload?.spectator;
            const spectator = spectatorRaw === true ||
                spectatorRaw === 1 ||
                spectatorRaw === '1' ||
                spectatorRaw === 'true' ||
                spectatorRaw === 'yes' ||
                spectatorRaw === 'y';
            const silentRaw = payload?.silent;
            const hiddenRaw = payload?.hidden;
            const silent = silentRaw === true ||
                silentRaw === 1 ||
                silentRaw === '1' ||
                silentRaw === 'true' ||
                silentRaw === 'yes' ||
                silentRaw === 'y' ||
                hiddenRaw === true ||
                hiddenRaw === 1 ||
                hiddenRaw === '1' ||
                hiddenRaw === 'true' ||
                hiddenRaw === 'yes' ||
                hiddenRaw === 'y';
            if (!Number.isFinite(roomId) || roomId <= 0) {
                throw new Error('roomId invalide');
            }
            if (this.roomsService.isBanned(roomId, meta.userId)) {
                await this.sendError(client, 'Banni de cette table.');
                return;
            }
            const effectiveSilent = Boolean(silent);
            if (effectiveSilent && !meta.isAdmin) {
                client.close(4003, 'Mode caché réservé aux admins');
                return;
            }
            let effectiveSpectator = spectator || effectiveSilent;
            if (effectiveSpectator && !effectiveSilent) {
                const allowed = await this.canSpectate(roomId, meta.userId);
                if (!allowed) {
                    client.close(4003, 'Spectateur non autorise sur cette table');
                    return;
                }
            }
            if (!effectiveSpectator) {
                try {
                    await this.roomsService.joinRoom(roomId, meta.userId);
                }
                catch (err) {
                    const reason = err.message;
                    const state = await this.roomsService.getRoomPayload(roomId);
                    const isOwner = state.room.owner?.id === meta.userId;
                    const isParticipant = state.room.players?.some((p) => p?.id === meta.userId) ?? false;
                    const started = (state.room.status || '').toLowerCase() === 'started' ||
                        Boolean(state.room.startedAt);
                    if (started) {
                        if (isOwner || isParticipant) {
                        }
                        else {
                            const allowed = await this.canSpectate(roomId, meta.userId);
                            if (!allowed) {
                                throw new Error(reason);
                            }
                            effectiveSpectator = true;
                        }
                    }
                    else {
                        throw err;
                    }
                }
            }
            const previousRoomId = meta.roomId;
            const previousRole = meta.role;
            const previousSilent = meta.silent === true;
            if (previousRoomId !== roomId || previousSilent !== effectiveSilent) {
                const previousSet = this.rooms.get(previousRoomId);
                if (previousSet) {
                    previousSet.delete(client);
                    if (previousSet.size === 0) {
                        this.rooms.delete(previousRoomId);
                    }
                }
                const previousSilentSet = this.silentRooms.get(previousRoomId);
                if (previousSilentSet) {
                    previousSilentSet.delete(client);
                    if (previousSilentSet.size === 0) {
                        this.silentRooms.delete(previousRoomId);
                    }
                }
                if (effectiveSilent) {
                    if (!this.silentRooms.has(roomId)) {
                        this.silentRooms.set(roomId, new Set());
                    }
                    this.silentRooms.get(roomId).add(client);
                }
                else {
                    if (!this.rooms.has(roomId)) {
                        this.rooms.set(roomId, new Set());
                    }
                    this.rooms.get(roomId).add(client);
                }
            }
            meta.roomId = roomId;
            meta.role = effectiveSpectator ? 'spectator' : 'participant';
            meta.silent = effectiveSilent;
            this.realtimeTracker.setSocketParticipantRoom(client, meta.role === 'participant' && meta.silent !== true
                ? meta.roomId
                : null);
            if (effectiveSilent) {
                await this.sendRoomStateToClient(client, roomId, {
                    includeRealtimePlayers: true,
                    includeHiddenSelf: { userId: meta.userId, username: meta.username },
                });
            }
            else {
                await this.sendRoomState(roomId);
            }
            if (Number.isFinite(previousRoomId) &&
                previousRoomId > 0 &&
                previousRoomId !== roomId) {
                await this.leavePreviousRoomOnSwitch(previousRoomId, meta.userId, previousRole);
            }
        }, {
            userId: meta.userId,
            roomId: payload?.roomId ?? payload?.room ?? null,
            ...trace,
        });
    }
    async leavePreviousRoomOnSwitch(previousRoomId, userId, previousRole) {
        try {
            if (previousRole === 'spectator') {
                await this.roomsService.transferOwnerIfCurrent(previousRoomId, userId);
            }
            await this.roomsService.leaveRoom(previousRoomId, userId, {
                preserveRoom: false,
                disconnectOnly: false,
            });
        }
        catch {
        }
        try {
            await this.sendRoomState(previousRoomId);
        }
        catch {
        }
    }
    async handleKickOrBan(meta, payload, ban) {
        const roomId = meta.roomId;
        if (!Number.isFinite(roomId) || roomId <= 0) {
            throw new Error('roomId invalide');
        }
        const targetRaw = payload?.userId ?? payload?.id ?? payload?.targetUserId;
        const targetUserId = Number(targetRaw);
        if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
            throw new Error('userId invalide');
        }
        if (targetUserId === meta.userId) {
            throw new Error('Impossible de se cibler soi-meme');
        }
        const state = await this.roomsService.getRoomPayload(roomId);
        const ownerId = state?.room?.owner?.id ?? 0;
        if (ownerId !== meta.userId) {
            throw new Error('Seul le proprietaire peut effectuer cette action');
        }
        if (ownerId === targetUserId) {
            throw new Error('Impossible de cibler le proprietaire');
        }
        const spectators = (0, room_roster_1.listVisibleSpectators)(this.clients.values(), roomId);
        const isOnTable = (state?.room?.players?.some((p) => p?.id === targetUserId) ?? false) ||
            spectators.some((s) => s?.id === targetUserId) ||
            this.hasUserConnections(roomId, targetUserId);
        if (!isOnTable) {
            throw new Error('Utilisateur introuvable sur la table');
        }
        if (ban) {
            this.roomsService.ban(roomId, targetUserId);
        }
        try {
            await this.roomsService.leaveRoom(roomId, targetUserId, {
                preserveRoom: true,
                disconnectOnly: false,
            });
        }
        catch {
        }
        const message = ban
            ? 'Vous avez ete banni de cette table.'
            : 'Vous avez ete exclu de cette table.';
        await this.forceDisconnectUser(roomId, targetUserId, message);
        await this.sendRoomState(roomId);
    }
    async handleSetOwner(meta, payload) {
        const roomId = meta.roomId;
        if (!Number.isFinite(roomId) || roomId <= 0) {
            throw new Error('roomId invalide');
        }
        const targetRaw = payload?.userId ?? payload?.id ?? payload?.newOwnerId;
        const newOwnerId = Number(targetRaw);
        if (!Number.isFinite(newOwnerId) || newOwnerId <= 0) {
            throw new Error('userId invalide');
        }
        if (newOwnerId === meta.userId) {
            return;
        }
        const state = await this.roomsService.getRoomPayload(roomId);
        const ownerId = state?.room?.owner?.id ?? 0;
        if (ownerId !== meta.userId) {
            throw new Error('Seul le proprietaire peut changer le proprietaire');
        }
        const spectators = (0, room_roster_1.listVisibleSpectators)(this.clients.values(), roomId);
        const isOnTable = (state?.room?.players?.some((p) => p?.id === newOwnerId) ?? false) ||
            spectators.some((s) => s?.id === newOwnerId) ||
            this.hasUserConnections(roomId, newOwnerId);
        if (!isOnTable) {
            throw new Error('Utilisateur introuvable sur la table');
        }
        await this.roomsService.setOwner(roomId, meta.userId, newOwnerId);
        await this.sendRoomState(roomId);
    }
    async forceDisconnectUser(roomId, userId, message) {
        const sockets = [];
        const a = this.rooms.get(roomId);
        const b = this.silentRooms.get(roomId);
        if (a)
            sockets.push(...Array.from(a));
        if (b)
            sockets.push(...Array.from(b));
        for (const socket of sockets) {
            const meta = this.clients.get(socket);
            if (!meta || meta.roomId !== roomId || meta.userId !== userId) {
                continue;
            }
            try {
                this.safeSend(socket, {
                    type: 'error',
                    roomId,
                    payload: { message },
                });
            }
            catch {
            }
            this.realtimeTracker.setSocketParticipantRoom(socket, null);
            this.realtimeTracker.clearSocket(socket);
            a?.delete(socket);
            b?.delete(socket);
            meta.role = 'spectator';
            meta.roomId = 0;
            meta.silent = false;
            try {
                const leftPayload = await this.roomsService.getRoomPayload(roomId);
                this.applySpectators(roomId, leftPayload);
                this.safeSend(socket, {
                    type: 'room.left',
                    roomId,
                    payload: leftPayload,
                });
            }
            catch {
                this.safeSend(socket, { type: 'room.deleted', roomId });
            }
        }
        if (a && a.size === 0)
            this.rooms.delete(roomId);
        if (b && b.size === 0)
            this.silentRooms.delete(roomId);
    }
    isAdmin(roles) {
        if (!roles || roles.length === 0)
            return false;
        return roles.some((r) => {
            const v = (r || '').trim().toLowerCase();
            return v === 'role_admin' || v === 'admin' || v === 'administrator';
        });
    }
    hasUserConnections(roomId, userId) {
        const set = this.rooms.get(roomId);
        if (set) {
            for (const socket of set.values()) {
                const meta = this.clients.get(socket);
                if (meta?.userId === userId && meta.roomId === roomId)
                    return true;
            }
        }
        const silentSet = this.silentRooms.get(roomId);
        if (silentSet) {
            for (const socket of silentSet.values()) {
                const meta = this.clients.get(socket);
                if (meta?.userId === userId && meta.roomId === roomId)
                    return true;
            }
        }
        return false;
    }
    async handleSetAmbience(client, meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.setAmbience.total', async () => {
            const raw = String(payload?.soundId ?? '').trim();
            const soundId = raw.length ? raw : null;
            const allowed = new Set([
                'TableAmbience1',
                'TableAmbience2',
                'TableAmbience3',
                'TableAmbience4',
                'TableAmbience5',
                'TableAmbience6',
                'TableAmbience7',
                'TableAmbience8',
                'TableAmbience9',
                'TableAmbience10',
                'TableAmbience11',
                'TableAmbience12',
                'TableAmbience13',
                'TableAmbience14',
                'TableAmbience15',
                'TableAmbience16',
                'TableAmbience17',
                'TableAmbience18',
                'TableAmbience19',
                'TableAmbience20',
            ]);
            if (soundId != null && !allowed.has(soundId)) {
                await this.sendError(client, `Ambiance invalide: ${soundId}`);
                return;
            }
            const room = await this.roomsService.requireRoomForOwnerAction(meta.roomId, meta.userId);
            room.tableAmbienceSoundId = soundId;
            await this.roomsService.saveRoom(room);
            const updated = await this.tryUpdateRoomPayload(meta.roomId, (p) => {
                p.room.tableAmbienceSoundId = soundId;
                p.generatedAt = new Date().toISOString();
                return p;
            });
            if (!updated) {
                await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
                await this.sendRoomState(meta.roomId);
            }
        }, { roomId: meta.roomId, userId: meta.userId, ...trace });
    }
    buildParticipantLeaveKey(roomId, userId) {
        return `${roomId}:${userId}`;
    }
    clearPendingParticipantLeave(roomId, userId) {
        const key = this.buildParticipantLeaveKey(roomId, userId);
        const existing = this.pendingParticipantLeaves.get(key);
        if (!existing)
            return;
        clearTimeout(existing);
        this.pendingParticipantLeaves.delete(key);
    }
    scheduleDelayedParticipantLeave(roomId, userId) {
        const key = this.buildParticipantLeaveKey(roomId, userId);
        if (this.pendingParticipantLeaves.has(key))
            return;
        const timeout = setTimeout(() => {
            this.pendingParticipantLeaves.delete(key);
            if (this.hasUserConnections(roomId, userId))
                return;
            this.roomsService
                .leaveRoom(roomId, userId, {
                preserveRoom: true,
                disconnectOnly: false,
            })
                .then(() => this.sendRoomState(roomId))
                .catch(() => { });
        }, this.participantDisconnectGraceMs);
        this.pendingParticipantLeaves.set(key, timeout);
    }
    async canSpectate(roomId, userId) {
        try {
            if (this.roomsService.isBanned(roomId, userId)) {
                return false;
            }
            const state = await this.roomsService.getRoomPayload(roomId);
            if (!state?.room)
                return false;
            if (!state.room.isPrivate) {
                return true;
            }
            const isOwner = state.room.owner?.id === userId;
            const isParticipant = state.room.players?.some((p) => p?.id === userId) ?? false;
            if (isOwner || isParticipant)
                return true;
            const started = (state.room.status || '').toLowerCase() === 'started' ||
                Boolean(state.room.startedAt);
            return started && this.invites.canSpectate(roomId, userId);
        }
        catch {
            return false;
        }
    }
};
exports.RoomGateway = RoomGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", typeof (_a = typeof ws_1.Server !== "undefined" && ws_1.Server) === "function" ? _a : Object)
], RoomGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('message'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof ws_1.WebSocket !== "undefined" && ws_1.WebSocket) === "function" ? _b : Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleMessage", null);
exports.RoomGateway = RoomGateway = RoomGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/ws' }),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => bot_service_1.BotService))),
    __metadata("design:paramtypes", [room_service_1.RoomService,
        bot_service_1.BotService,
        ws_jwt_auth_service_1.WsJwtAuthService,
        catalog_service_1.CatalogService,
        perf_metrics_service_1.PerfMetricsService,
        room_invite_service_1.RoomInviteService,
        client_updates_service_1.ClientUpdatesService,
        ws_ticket_auth_service_1.WsTicketAuthService,
        room_realtime_tracker_service_1.RoomRealtimeTrackerService])
], RoomGateway);
//# sourceMappingURL=room.gateway.js.map