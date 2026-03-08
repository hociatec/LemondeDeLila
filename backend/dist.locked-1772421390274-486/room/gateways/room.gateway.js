"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomGateway", {
    enumerable: true,
    get: function() {
        return RoomGateway;
    }
});
const _websockets = require("@nestjs/websockets");
const _ws = require("ws");
const _roomservice = require("../services/room.service");
const _botservice = require("../../bot/services/bot.service");
const _common = require("@nestjs/common");
const _wsjwtauthservice = require("../../common/ws/ws-jwt-auth.service");
const _catalogservice = require("../../catalog/services/catalog.service");
const _perfmetricsservice = require("../../common/services/perf-metrics.service");
const _roominviteservice = require("../services/room-invite.service");
const _clientupdatesservice = require("../../client-updates/services/client-updates.service");
const _versionutils = require("../../common/utils/version.utils");
const _wsticketauthservice = require("../../common/ws/ws-ticket-auth.service");
const _roomrealtimetrackerservice = require("../services/room-realtime-tracker.service");
const _roomwsparams = require("./room-ws-params");
const _roomroster = require("./room-roster");
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
let RoomGateway = class RoomGateway {
    forceDisconnectRoomClients(roomId) {
        const targets = this.rooms.get(roomId);
        const silentTargets = this.silentRooms.get(roomId);
        const socketSet = new Set();
        if (targets) {
            for (const socket of targets)socketSet.add(socket);
        }
        if (silentTargets) {
            for (const socket of silentTargets)socketSet.add(socket);
        }
        // Fallback: certains sockets peuvent ne pas être dans les sets (état dégradé).
        // On éjecte tout client encore associé à la room pour éviter les "écrans bloqués".
        for (const [socket, meta] of this.clients.entries()){
            if (meta?.roomId === roomId) {
                socketSet.add(socket);
            }
        }
        const all = Array.from(socketSet);
        // Important: `ws` send is async; closing immediately can drop the last message.
        // We therefore send 'room.deleted' and close the socket in the send callback.
        const deletedMessage = JSON.stringify({
            type: 'room.deleted',
            roomId
        });
        for (const socket of all){
            // Important: retirer avant close pour éviter handleDisconnect/leaveRoom en cascade.
            this.realtimeTracker.clearSocket(socket);
            this.clients.delete(socket);
            targets?.delete(socket);
            silentTargets?.delete(socket);
            try {
                if (socket.readyState === _ws.WebSocket.OPEN) {
                    socket.send(deletedMessage, ()=>{
                        try {
                            socket.close();
                        } catch  {
                        /* ignore */ }
                    });
                } else {
                    socket.close();
                }
            } catch  {
            /* ignore */ }
        }
        if (targets?.size === 0) this.rooms.delete(roomId);
        if (silentTargets?.size === 0) this.silentRooms.delete(roomId);
    }
    async handleConnection(client, ...args) {
        // WS ticket (short-lived) required.
        if (!this.wsTickets.validate(client, args, 'room')) {
            this.logger.warn('Connexion WS refusée: ticket manquant ou invalide.');
            client.close(4403, 'ws ticket requis');
            return;
        }
        const clientVersion = this.auth.extractClientVersion(client, args);
        const minRequired = await this.clientUpdates.getMinRequiredVersion();
        if (minRequired) {
            const outdated = !clientVersion || (0, _versionutils.isVersionLower)(clientVersion, minRequired) === true;
            if (outdated) {
                client.close(4406, 'update required');
                return;
            }
        }
        const { token, roomId, spectator, silent } = (0, _roomwsparams.extractRoomWsParams)(client, args);
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
                // Keep the socket open so the client can go back to home and join another room.
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
                        exceptRoomId: targetRoomId
                    });
                } catch  {
                // ignore
                }
                const allowed = await this.canSpectate(targetRoomId, payload.id);
                if (!allowed) {
                    client.close(4003, 'Spectateur non autorise sur cette table');
                    return;
                }
                // Alignement avec `room.set-role`: si on connecte directement en spectateur sur une table non démarrée,
                // on se retire des participants quand c'est autorisé (public, ou owner sur privé) pour éviter d'apparaître
                // à la fois dans `players` (DB) et `spectators` (WS).
                try {
                    const state = await this.roomsService.getRoomPayload(targetRoomId);
                    const isOwner = state.room.owner?.id === payload.id;
                    const started = (state.room.status || '').toLowerCase() === 'started' || Boolean(state.room.startedAt);
                    if (!started && (!state.room.isPrivate || isOwner)) {
                        await this.roomsService.leaveRoom(targetRoomId, payload.id, {
                            preserveRoom: true,
                            preserveOwner: isOwner
                        });
                    }
                } catch  {
                // ignore: best effort
                }
            } else if (role !== 'spectator') {
                try {
                    await this.roomsService.joinRoom(targetRoomId, payload.id);
                } catch (err) {
                    const reason = err.message;
                    // Reconnexion : si la table est démarrée, joinRoom() refuse. On autorise toutefois si l'utilisateur est déjà participant.
                    try {
                        const state = await this.roomsService.getRoomPayload(targetRoomId);
                        const isOwner = state.room.owner?.id === payload.id;
                        const isParticipant = state.room.players?.some((p)=>p?.id === payload.id) ?? false;
                        const isPrivate = Boolean(state.room.isPrivate);
                        const started = (state.room.status || '').toLowerCase() === 'started' || Boolean(state.room.startedAt);
                        if (!isOwner && !isParticipant) {
                            // Table démarrée: si l'utilisateur n'est pas joueur, on tente un fallback en spectateur
                            // (utile pour les tables privées: autoriser si invité).
                            if (started) {
                                try {
                                    await this.roomsService.leaveAllRoomsForUser(payload.id, {
                                        exceptRoomId: targetRoomId
                                    });
                                } catch  {
                                // ignore
                                }
                                const allowed = await this.canSpectate(targetRoomId, payload.id);
                                if (allowed) {
                                    role = 'spectator';
                                } else {
                                    await this.sendError(client, reason);
                                    client.close(4003, reason);
                                    return;
                                }
                            } else if (!isPrivate) {
                                role = 'spectator';
                            } else {
                                // Important: envoyer un message d'erreur avant de fermer la socket,
                                // pour que le client puisse afficher un dialogue explicite (ex: table privée).
                                await this.sendError(client, reason);
                                client.close(4003, reason);
                                return;
                            }
                        }
                    } catch  {
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
                isAdmin
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
                isAdmin
            });
        }
        const initialMeta = this.clients.get(client);
        if (initialMeta?.silent) {
            if (!this.silentRooms.has(targetRoomId)) {
                this.silentRooms.set(targetRoomId, new Set());
            }
            this.silentRooms.get(targetRoomId).add(client);
        } else {
            if (!this.rooms.has(targetRoomId)) {
                this.rooms.set(targetRoomId, new Set());
            }
            this.rooms.get(targetRoomId).add(client);
        }
        this.realtimeTracker.setSocketParticipantRoom(client, initialMeta?.role === 'participant' && initialMeta?.silent !== true ? initialMeta.roomId : null);
        // Heartbeat : ping régulier pour maintenir la connexion et détecter les resets silencieux.
        this.lastPong.set(client, Date.now());
        client.on('pong', ()=>this.lastPong.set(client, Date.now()));
        const hb = setInterval(()=>{
            try {
                if (client.readyState !== _ws.WebSocket.OPEN) {
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
                    } catch  {
                        try {
                            client.close();
                        } catch  {
                        /* ignore */ }
                    }
                    return;
                }
                client.ping?.();
            } catch  {
            // ignore
            }
        }, this.pingIntervalMs);
        this.heartbeats.set(client, hb);
        client.on('message', (raw)=>this.handleMessage(client, raw));
        client.on('error', ()=>client.close());
        if (targetRoomId > 0) {
            if (initialMeta?.silent) {
                await this.sendRoomStateToClient(client, targetRoomId, {
                    includeRealtimePlayers: true,
                    includeHiddenSelf: {
                        userId: initialMeta.userId,
                        username: initialMeta.username
                    }
                });
            } else {
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
        // Sur déconnexion on ne veut jamais "supprimer" une table par erreur.
        // Si l'état de la table est indéterminé (ex: DB temporairement indisponible),
        // on traite la déconnexion comme un simple disconnect (disconnectOnly=true),
        // ce qui évite de marquer le joueur comme parti et de déclencher une suppression.
        let roomStarted = false;
        let ownerId = null;
        if (meta && meta.roomId > 0) {
            try {
                const state = await this.roomsService.getRoomPayload(meta.roomId);
                ownerId = state?.room?.owner?.id ?? null;
                roomStarted = (state?.room?.status || '').toLowerCase() === 'started' || Boolean(state?.room?.startedAt);
            } catch  {
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
                } else {
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
                } else {
                    remainingSilentConnections = silentSet.size;
                }
            }
            const remainingTotalConnections = remainingConnections + remainingSilentConnections;
            const userStillConnected = this.hasUserConnections(meta.roomId, meta.userId);
            // si plus aucune connexion pour cette room, on supprime la table côté service
            if (meta.role === 'participant') {
                // Important: ne pas "quitter" en DB si l'utilisateur a encore une autre connexion
                // (ex: double socket silent/visible, reconnexion rapide).
                if (!userStillConnected) {
                    // Sur déconnexion on ne veut jamais supprimer une table par erreur.
                    // On marque toutefois le joueur comme parti (et donc remplaçable par un bot en partie démarrée),
                    // sauf si l'état de la table est indéterminé (ex: DB temporairement indisponible).
                    const disconnectOnly = true;
                    this.roomsService.leaveRoom(meta.roomId, meta.userId, {
                        preserveRoom: true,
                        disconnectOnly
                    }).catch(()=>{});
                    if (roomStarted === true) {
                        this.scheduleDelayedParticipantLeave(meta.roomId, meta.userId);
                    }
                }
            } else {
                if (!userStillConnected && ownerId === meta.userId) {
                    this.roomsService.transferOwnerIfCurrent(meta.roomId, meta.userId).catch(()=>{});
                }
                if (remainingTotalConnections === 0) {
                    this.roomsService.leaveRoom(meta.roomId, meta.userId, {
                        preserveRoom: false,
                        disconnectOnly: false
                    }).catch(()=>{});
                }
            }
            if (meta.roomId > 0 && meta.silent !== true) {
                this.sendRoomState(meta.roomId).catch(()=>{});
            }
        }
    }
    async handleMessage(client, raw) {
        await this.enqueueClientMessage(client, async ()=>{
            const meta = this.clients.get(client);
            if (!meta) {
                client.close();
                return;
            }
            try {
                const parsed = this.decode(raw);
                if (!parsed) return;
                await this.handleCommand(client, meta, parsed);
            } catch (err) {
                await this.sendError(client, err.message || 'Erreur temps réel');
            }
        });
    }
    enqueueClientMessage(client, fn) {
        const prev = this.messageQueueByClient.get(client) ?? Promise.resolve();
        const next = prev.then(fn, fn);
        // Keep the chain alive even if one handler throws.
        this.messageQueueByClient.set(client, next.catch(()=>{}));
        return next;
    }
    async sendRoomState(roomId) {
        try {
            let payload = await this.roomsService.getRoomPayload(roomId);
            const previousStatus = (this.lastRoomStatusByRoomId.get(roomId) ?? '').toLowerCase().trim();
            const nextStatus = String(payload?.room?.status ?? '').toLowerCase().trim();
            if (previousStatus === 'started' && nextStatus && nextStatus !== 'started') {
                await this.promoteConnectedSpectatorsToParticipants(roomId);
                await this.roomsService.invalidateRoomPayloadCache(roomId);
                payload = await this.roomsService.getRoomPayload(roomId);
            }
            this.lastRoomStatusByRoomId.set(roomId, nextStatus);
            this.applySpectators(roomId, payload);
            await this.broadcastRoomUpdated(roomId, payload);
        } catch  {
        /* la table a peut-être été supprimée, on ignore */ }
    }
    applySpectators(roomId, payload) {
        payload.room.spectators = (0, _roomroster.listVisibleSpectators)(this.clients.values(), roomId);
        payload.room.counts.spectators = payload.room.spectators.length;
        // Garde-fou: éviter qu'un utilisateur apparaisse à la fois dans `players` (participants DB)
        // et `spectators` (role socket) avant le démarrage.
        const started = (payload.room.status || '').toLowerCase() === 'started' || Boolean(payload.room.startedAt);
        if (!started && payload.room.players?.length && payload.room.spectators?.length) {
            const spectatorIds = new Set(payload.room.spectators.map((s)=>s.id));
            payload.room.players = payload.room.players.filter((p)=>!spectatorIds.has(p.id));
            payload.room.counts.players = payload.room.players.length;
        }
        // Garde-fou (y compris en partie démarrée): si un utilisateur est joueur (DB),
        // il ne doit pas apparaître en spectateur.
        if (payload.room.players?.length && payload.room.spectators?.length) {
            const playerIds = new Set(payload.room.players.map((p)=>p.id));
            payload.room.spectators = payload.room.spectators.filter((s)=>!playerIds.has(s.id));
            payload.room.counts.spectators = payload.room.spectators.length;
        }
    }
    buildAllowedActionsForClient(meta, payload) {
        const room = payload.room;
        const started = (room.status || '').toLowerCase() === 'started' || Boolean(room.startedAt);
        const isOwner = room.owner?.id === meta.userId;
        const isParticipant = room.players?.some((p)=>p?.id === meta.userId) ?? false;
        const canToggleRole = !started && (!room.isPrivate || isOwner || isParticipant);
        const actions = new Set([
            'room.rules',
            'room.info',
            'room.players',
            'room.leave',
            'room.tableAmbienceVolume'
        ]);
        if (canToggleRole) {
            actions.add('room.set-role');
        }
        if (isOwner) {
            actions.add('room.start');
            actions.add('room.reset');
            actions.add('room.toggle-privacy');
            actions.add('bot.add');
            actions.add('bot.remove');
            actions.add('room.kick');
            actions.add('room.ban');
            actions.add('room.set-owner');
            actions.add('room.set-ambience');
            actions.add('room.tableAmbience');
            actions.add('room.snapshot.save');
        }
        return Array.from(actions);
    }
    withAllowedActionsForClient(payload, meta) {
        return {
            ...payload,
            room: {
                ...payload.room,
                allowedActions: this.buildAllowedActionsForClient(meta, payload)
            }
        };
    }
    async broadcastRoomUpdated(roomId, payload) {
        const targets = this.rooms.get(roomId);
        const silentTargets = this.silentRooms.get(roomId);
        const sendToSet = (set)=>{
            if (!set) return;
            for (const socket of Array.from(set)){
                const meta = this.clients.get(socket);
                if (!meta || socket.readyState !== _ws.WebSocket.OPEN) {
                    set.delete(socket);
                    continue;
                }
                try {
                    const payloadForClient = this.withAllowedActionsForClient(payload, meta);
                    socket.send(JSON.stringify({
                        type: 'room.updated',
                        roomId,
                        payload: payloadForClient
                    }));
                } catch  {
                    set.delete(socket);
                    try {
                        socket.close();
                    } catch  {
                    /* ignore */ }
                }
            }
            if (set.size === 0) {
                if (set === targets) this.rooms.delete(roomId);
                if (set === silentTargets) this.silentRooms.delete(roomId);
            }
        };
        sendToSet(targets);
        sendToSet(silentTargets);
    }
    async broadcastRoomIntent(roomId, intent) {
        await this.broadcast(roomId, 'room.intent', intent);
    }
    buildStartWizardIntent(payload, previousStatus, nextStatus) {
        if (previousStatus.length === 0 && nextStatus.length > 0 && nextStatus !== 'started') {
            return {
                ownerId: payload.room.owner?.id ?? null,
                title: 'Configuration de la table',
                description: 'Le serveur vous invite à préparer la partie.',
                message: 'Choisissez rapidement l’ambiance et la configuration.'
            };
        }
        return null;
    }
    computeStatusFocusIntent(roomId, payload) {
        const previousStatus = (this.lastRoomStatusByRoomId.get(roomId) ?? '').toLowerCase().trim();
        const nextStatus = String(payload.room.status ?? '').toLowerCase().trim();
        if (previousStatus !== 'started' && nextStatus === 'started') {
            return {
                region: 'game',
                reason: 'room.started',
                priority: 'assertive'
            };
        }
        return null;
    }
    async broadcastRoomPayload(roomId, payload) {
        const previousStatus = (this.lastRoomStatusByRoomId.get(roomId) ?? '').toLowerCase().trim();
        const nextStatus = String(payload.room.status ?? '').toLowerCase().trim();
        this.applySpectators(roomId, payload);
        const focusIntent = this.computeStatusFocusIntent(roomId, payload);
        await this.broadcastRoomUpdated(roomId, payload);
        if (focusIntent) {
            await this.broadcast(roomId, 'room.focus', focusIntent);
            await this.broadcastRoomIntent(roomId, {
                type: 'focus',
                payload: focusIntent
            });
            await this.broadcastRoomIntent(roomId, {
                type: 'announcement',
                payload: {
                    message: focusIntent.reason === 'room.started' ? 'La table commence !' : 'Mise à jour de la table en cours.',
                    priority: focusIntent.priority === 'assertive' ? 'assertive' : 'polite'
                }
            });
        }
        const previousSnapshot = this.lastRoomSnapshotByRoomId.get(roomId);
        const nextSnapshot = this.buildRoomSnapshot(payload);
        await this.emitRoomAnnouncementsFromDiff(roomId, previousSnapshot, nextSnapshot);
        this.lastRoomSnapshotByRoomId.set(roomId, nextSnapshot);
        const startWizardIntent = this.buildStartWizardIntent(payload, previousStatus, nextStatus);
        if (startWizardIntent) {
            await this.broadcastRoomIntent(roomId, {
                type: 'start-wizard',
                payload: startWizardIntent
            });
            const gameName = (payload.manifest?.name ?? payload.room.gameType ?? '').trim();
            const creationMessage = gameName.length === 0 ? 'Table créée. Ajoutez des bots et commencez à jouer (Entrée).' : `Table de ${gameName} créée. Ajoutez des bots et commencez à jouer (Entrée).`;
            await this.broadcastRoomIntent(roomId, {
                type: 'announcement',
                payload: {
                    message: creationMessage
                }
            });
        }
        this.lastRoomStatusByRoomId.set(roomId, nextStatus);
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
                payload.room.spectators = (0, _roomroster.addHiddenSelf)(payload.room.spectators, opts.includeHiddenSelf);
                payload.room.counts.spectators = payload.room.spectators.length;
            }
            if (opts?.includeRealtimePlayers) {
                const connected = (0, _roomroster.listConnectedPlayers)(this.clients.values(), roomId);
                payload.room.players = (0, _roomroster.mergePlayers)(payload.room.players, connected);
                payload.room.counts.players = payload.room.players.length;
            }
            const previousStatus = (this.lastRoomStatusByRoomId.get(roomId) ?? '').toLowerCase().trim();
            const nextStatus = String(payload.room.status ?? '').toLowerCase().trim();
            const focusIntent = this.computeStatusFocusIntent(roomId, payload);
            const meta = this.clients.get(client);
            const payloadForClient = meta != null ? this.withAllowedActionsForClient(payload, meta) : payload;
            this.safeSend(client, {
                type: 'room.updated',
                roomId,
                payload: payloadForClient
            });
            if (focusIntent) {
                this.safeSend(client, {
                    type: 'room.focus',
                    roomId,
                    payload: focusIntent
                });
                this.safeSend(client, {
                    type: 'room.intent',
                    roomId,
                    payload: {
                        type: 'focus',
                        payload: focusIntent
                    }
                });
                this.safeSend(client, {
                    type: 'room.intent',
                    roomId,
                    payload: {
                        type: 'announcement',
                        payload: {
                            message: focusIntent.reason == 'room.started' ? 'La table commence !' : 'Mise à jour de la table en cours.',
                            priority: focusIntent.priority == 'assertive' ? 'assertive' : 'polite'
                        }
                    }
                });
            }
            const startWizardIntent = this.buildStartWizardIntent(payload, previousStatus, nextStatus);
            if (startWizardIntent) {
                this.safeSend(client, {
                    type: 'room.intent',
                    roomId,
                    payload: {
                        type: 'start-wizard',
                        payload: startWizardIntent
                    }
                });
            }
            this.lastRoomSnapshotByRoomId.set(roomId, this.buildRoomSnapshot(payload));
            this.lastRoomStatusByRoomId.set(roomId, nextStatus);
        } catch (err) {
            await this.sendError(client, err.message || 'Erreur table');
            try {
                client.close(4003, 'room not found');
            } catch  {
            /* ignore */ }
        }
    }
    async broadcast(roomId, type, payload, emittedRoomId) {
        const message = JSON.stringify({
            type,
            roomId: emittedRoomId ?? roomId,
            payload
        });
        const targets = this.rooms.get(roomId);
        const silentTargets = this.silentRooms.get(roomId);
        const sendToSet = (set)=>{
            if (!set) return;
            for (const socket of Array.from(set)){
                if (socket.readyState !== _ws.WebSocket.OPEN) {
                    set.delete(socket);
                    continue;
                }
                try {
                    socket.send(message);
                } catch  {
                    set.delete(socket);
                    try {
                        socket.close();
                    } catch  {
                    /* ignore */ }
                }
            }
            if (set.size === 0) {
                if (set === targets) this.rooms.delete(roomId);
                if (set === silentTargets) this.silentRooms.delete(roomId);
            }
        };
        sendToSet(targets);
        sendToSet(silentTargets);
    }
    async sendError(client, message) {
        if (client.readyState !== _ws.WebSocket.OPEN) return;
        client.send(JSON.stringify({
            type: 'error',
            payload: {
                message
            }
        }));
    }
    safeSend(client, payload) {
        if (client.readyState !== _ws.WebSocket.OPEN) {
            return;
        }
        try {
            client.send(JSON.stringify(payload));
        } catch  {
            try {
                client.close();
            } catch  {
            /* ignore */ }
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
            const parsed = JSON.parse(text);
            return parsed;
        } catch  {
            return null;
        }
    }
    async handleCommand(client, meta, payload) {
        const type = payload?.type;
        const data = payload?.payload ?? {};
        const receivedAtMs = Date.now();
        if (type === 'room.intent.execute') {
            await this.handleRoomIntentExecute(client, meta, data, receivedAtMs);
            return;
        }
        this.sendImmediateAckIfNeeded(client, meta, type, data, receivedAtMs);
        await this.executeLegacyRoomCommand(client, meta, type, data, receivedAtMs);
    }
    async handleRoomIntentExecute(client, meta, payload, receivedAtMs) {
        const envelope = payload != null && typeof payload === 'object' ? payload : {};
        const intentIdRaw = typeof envelope.intentId === 'string' ? envelope.intentId : typeof envelope.action === 'string' ? envelope.action : typeof envelope.type === 'string' ? envelope.type : '';
        const intentId = intentIdRaw.trim().toLowerCase();
        if (intentId.length === 0) {
            throw new Error('intentId requis');
        }
        const legacyType = RoomGateway.mapIntentToLegacyCommand(intentId);
        if (!legacyType) {
            throw new Error(`Intent inconnu: ${intentId}`);
        }
        const payloadSource = Object.prototype.hasOwnProperty.call(envelope, 'data') ? envelope.data : envelope.payload;
        const legacyPayload = payloadSource != null && typeof payloadSource === 'object' ? {
            ...payloadSource
        } : {};
        // Compat trace: accepte _trace dans l'enveloppe si absent dans data.
        if (!Object.prototype.hasOwnProperty.call(legacyPayload, '_trace') && envelope._trace != null && typeof envelope._trace === 'object') {
            legacyPayload._trace = envelope._trace;
        }
        this.sendImmediateAckIfNeeded(client, meta, legacyType, legacyPayload, receivedAtMs);
        await this.executeLegacyRoomCommand(client, meta, legacyType, legacyPayload, receivedAtMs);
    }
    sendImmediateAckIfNeeded(client, meta, type, payload, receivedAtMs) {
        if (!RoomGateway.isImmediateAckAction(type)) {
            return;
        }
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        this.safeSend(client, {
            type: 'room.ack',
            roomId: meta.roomId,
            payload: {
                action: type,
                traceId: trace.traceId,
                receivedAtMs,
                clientToServerMs: trace.clientToServerMs
            }
        });
    }
    static isImmediateAckAction(type) {
        return type === 'room.start' || type === 'room.reset' || type === 'bot.add' || type === 'bot.remove' || type === 'room.toggle-privacy' || type === 'room.kick' || type === 'room.ban' || type === 'room.set-owner' || type === 'room.set-ambience';
    }
    static mapIntentToLegacyCommand(intentId) {
        switch(intentId){
            case 'room.leave':
            case 'room.chat.send':
            case 'room.chat.history':
            case 'room.start':
            case 'room.reset':
            case 'room.set-role':
            case 'room.kick':
            case 'room.ban':
            case 'room.set-owner':
            case 'room.set-ambience':
            case 'room.toggle-privacy':
            case 'room.info':
            case 'room.ping':
            case 'bot.add':
            case 'bot.remove':
            case 'room.create':
            case 'room.join':
                return intentId;
            case 'room.toggle-role':
            case 'room.role.toggle':
                return 'room.set-role';
            default:
                return '';
        }
    }
    async executeLegacyRoomCommand(client, meta, type, data, receivedAtMs) {
        switch(type){
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
                        clientSentAtMs: typeof data?.clientSentAtMs === 'number' ? data.clientSentAtMs : data?._trace?.sentAtMs ?? null
                    }
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
            if (!enabled) return;
            const state = this.getRoomChatState(roomId);
            if (state.messages.length === 0) return;
            this.safeSend(client, {
                type: 'room.chat.history',
                roomId,
                payload: {
                    messages: state.messages
                }
            });
        } catch  {
        // best effort
        }
    }
    getRoomChatState(roomId) {
        const existing = this.roomChat.get(roomId);
        if (existing) return existing;
        const created = {
            nextSeq: 1,
            messages: []
        };
        this.roomChat.set(roomId, created);
        return created;
    }
    normalizeChatMessage(raw) {
        if (typeof raw !== 'string') return '';
        const trimmed = raw.replace(/\r?\n/g, ' ').trim();
        if (!trimmed) return '';
        if (trimmed.length <= this.chatMaxLength) return trimmed;
        return trimmed.slice(0, this.chatMaxLength).trim();
    }
    async isRoomChatEnabled(roomId) {
        try {
            const payload = await this.roomsService.getRoomPayload(roomId);
            return payload?.manifest?.chatEnabled !== false;
        } catch  {
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
            createdAt: new Date().toISOString()
        };
        state.messages.push(chatMessage);
        while(state.messages.length > this.roomChatLimit){
            state.messages.shift();
        }
        await this.broadcast(meta.roomId, 'room.chat.message', chatMessage);
    }
    extractTraceMeta(payload, receivedAtMs) {
        const traceId = payload && typeof payload === 'object' ? payload?._trace?.id : undefined;
        const sentAtMs = payload && typeof payload === 'object' ? payload?._trace?.sentAtMs : undefined;
        const id = typeof traceId === 'string' && traceId.trim().length > 0 ? traceId.trim() : null;
        const c2s = typeof sentAtMs === 'number' && Number.isFinite(sentAtMs) ? Math.max(0, receivedAtMs - sentAtMs) : null;
        return {
            traceId: id,
            clientToServerMs: c2s
        };
    }
    async handleRoomInfo(client, meta) {
        const roomId = meta.roomId;
        if (!Number.isFinite(roomId) || roomId <= 0) {
            return;
        }
        const state = await this.roomsService.getRoomPayload(roomId);
        state.room.spectators = (0, _roomroster.listVisibleSpectators)(this.clients.values(), roomId);
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
            payload: {
                message
            }
        });
    }
    buildRoomSnapshot(payload) {
        const room = payload.room;
        return {
            players: RoomGateway.buildPlayerMap(room.players),
            spectators: RoomGateway.buildPlayerMap(room.spectators),
            bots: RoomGateway.buildBotMap(room.bots),
            ownerId: room.owner?.id ?? null,
            ownerName: (room.owner?.username ?? '').trim(),
            isPrivate: Boolean(room.isPrivate)
        };
    }
    static buildPlayerMap(players) {
        const map = new Map();
        if (!players) {
            return map;
        }
        for (const player of players){
            if (!player || !Number.isFinite(player.id) || player.id <= 0) {
                continue;
            }
            map.set(player.id, (player.username ?? '').trim());
        }
        return map;
    }
    static buildBotMap(bots) {
        const map = new Map();
        if (!bots) {
            return map;
        }
        for (const bot of bots){
            if (!bot || !Number.isFinite(bot.id) || bot.id <= 0) {
                continue;
            }
            map.set(bot.id, (bot.name ?? '').trim());
        }
        return map;
    }
    async emitRoomAnnouncementsFromDiff(roomId, previous, next) {
        if (!previous) {
            return;
        }
        const roleSwitchIds = new Set();
        for (const id of previous.players.keys()){
            if (next.spectators.has(id)) {
                roleSwitchIds.add(id);
            }
        }
        for (const id of previous.spectators.keys()){
            if (next.players.has(id)) {
                roleSwitchIds.add(id);
            }
        }
        await this.emitPlayerDiff(roomId, previous.players, next.players, false, roleSwitchIds);
        await this.emitPlayerDiff(roomId, previous.spectators, next.spectators, true, roleSwitchIds);
        await this.emitBotDiff(roomId, previous.bots, next.bots);
        if (previous.ownerId !== next.ownerId || previous.ownerName !== next.ownerName) {
            const message = next.ownerName.length === 0 ? 'Propriétaire : aucun.' : `Nouveau propriétaire : ${next.ownerName}.`;
            await this.broadcastRoomAnnouncement(roomId, message);
        }
        if (previous.isPrivate !== next.isPrivate) {
            const message = next.isPrivate ? 'Table privée.' : 'Table publique.';
            await this.broadcastRoomAnnouncement(roomId, message);
        }
    }
    async emitPlayerDiff(roomId, previous, next, spectator, roleSwitchIds) {
        for (const [id, username] of next.entries()){
            if (roleSwitchIds.has(id)) {
                continue;
            }
            if (!previous.has(id)) {
                await this.broadcastRoomAnnouncement(roomId, RoomGateway.buildPlayerJoinedMessage(username, spectator));
            }
        }
        for (const [id, username] of previous.entries()){
            if (roleSwitchIds.has(id)) {
                continue;
            }
            if (!next.has(id)) {
                await this.broadcastRoomAnnouncement(roomId, RoomGateway.buildPlayerLeftMessage(username, spectator));
            }
        }
    }
    async emitBotDiff(roomId, previous, next) {
        for (const [id, name] of next.entries()){
            if (!previous.has(id)) {
                await this.broadcastRoomAnnouncement(roomId, RoomGateway.buildBotJoinedMessage(name));
            }
        }
        for (const [id, name] of previous.entries()){
            if (!next.has(id)) {
                await this.broadcastRoomAnnouncement(roomId, RoomGateway.buildBotLeftMessage(name));
            }
        }
    }
    async broadcastRoomAnnouncement(roomId, message, priority = 'polite') {
        const normalized = (message ?? '').trim();
        if (normalized.length === 0) {
            return;
        }
        await this.broadcastRoomIntent(roomId, {
            type: 'announcement',
            payload: {
                message: normalized,
                priority
            }
        });
    }
    static buildPlayerJoinedMessage(name, spectator) {
        return `${RoomGateway.formatPlayerName(name)}${spectator ? ' (spectateur)' : ''} a rejoint la table.`;
    }
    static buildPlayerLeftMessage(name, spectator) {
        return `${RoomGateway.formatPlayerName(name)}${spectator ? ' (spectateur)' : ''} a quitté la table.`;
    }
    static buildBotJoinedMessage(name) {
        return `${RoomGateway.formatBotName(name)} a rejoint la table.`;
    }
    static buildBotLeftMessage(name) {
        return `${RoomGateway.formatBotName(name)} a quitté la table.`;
    }
    static formatPlayerName(name) {
        const trimmed = (name ?? '').trim();
        return trimmed.length > 0 ? trimmed : 'Un joueur';
    }
    static formatBotName(name) {
        const trimmed = (name ?? '').trim();
        return trimmed.length > 0 ? trimmed : 'Un bot';
    }
    async handleRoomLeave(client, meta) {
        const roomId = meta.roomId;
        if (!Number.isFinite(roomId) || roomId <= 0) {
            return;
        }
        this.realtimeTracker.setSocketParticipantRoom(client, null);
        const userId = meta.userId;
        const wasParticipant = meta.role === 'participant';
        const activeSet = meta.silent ? this.silentRooms.get(roomId) : this.rooms.get(roomId);
        let remainingInActiveSet = 0;
        if (activeSet) {
            activeSet.delete(client);
            if (activeSet.size === 0) {
                if (meta.silent) {
                    this.silentRooms.delete(roomId);
                } else {
                    this.rooms.delete(roomId);
                }
                remainingInActiveSet = 0;
            } else {
                remainingInActiveSet = activeSet.size;
            }
        }
        const otherSet = meta.silent ? this.rooms.get(roomId) : this.silentRooms.get(roomId);
        const remainingInOtherSet = otherSet?.size ?? 0;
        const remainingTotalConnections = remainingInActiveSet + remainingInOtherSet;
        const userStillConnected = this.hasUserConnections(roomId, userId);
        // Empêche handleDisconnect de rappeler leaveRoom quand on ferme le socket après un leave explicite.
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
                payload: leftPayload
            });
        } catch  {
            this.safeSend(client, {
                type: 'room.deleted',
                roomId
            });
        }
        // Do not block on DB leave logic; allow the client to re-join instantly.
        (async ()=>{
            try {
                if (wasParticipant) {
                    await this.roomsService.leaveRoom(roomId, userId, {
                        // Leave explicite : si la table devient vide (plus aucun humain/bot), elle doit disparaître.
                        // Garder preserveRoom uniquement quand il reste d'autres connexions (autres joueurs / autre socket).
                        preserveRoom: remainingTotalConnections > 0,
                        disconnectOnly: false
                    });
                } else {
                    if (!userStillConnected) {
                        await this.roomsService.transferOwnerIfCurrent(roomId, userId);
                    }
                    if (remainingTotalConnections === 0) {
                        await this.roomsService.leaveRoom(roomId, userId, {
                            preserveRoom: false,
                            disconnectOnly: false
                        });
                    }
                }
            } catch  {
            // ignore: best effort
            }
            try {
                if (remainingTotalConnections > 0) {
                    await this.sendRoomState(roomId);
                }
            } catch  {
            // ignore
            }
        })().catch(()=>{});
    // Important: ne pas fermer la socket.
    // Le client doit pouvoir rester connecté et rejoindre une autre table sans relancer l’app.
    }
    async handleRoomStart(meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.start.total', async ()=>{
            const room = await this.roomsService.startRoom(meta.roomId, meta.userId, false);
            await this.broadcast(meta.roomId, 'state-updated', {
                roomId: meta.roomId
            });
            const updated = await this.tryUpdateRoomPayload(meta.roomId, (payload)=>{
                payload.room.status = room.status;
                payload.room.startedAt = room.startedAt ? room.startedAt.toISOString() : null;
                payload.room.runId = typeof room.runId === 'number' ? room.runId : null;
                payload.generatedAt = new Date().toISOString();
                return payload;
            });
            if (!updated) {
                await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
                await this.sendRoomState(meta.roomId);
            }
        }, {
            roomId: meta.roomId,
            userId: meta.userId,
            ...trace
        });
    }
    async handleRoomReset(meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.reset.total', async ()=>{
            await this.roomsService.resetRoom(meta.roomId, meta.userId, false);
            // Après un reset, tous les connectés "visibles" doivent être considérés comme joueurs.
            // (Les admins en mode silent restent en dehors du roster.)
            await this.promoteConnectedSpectatorsToParticipants(meta.roomId);
            await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
            await this.broadcast(meta.roomId, 'state-updated', {
                roomId: meta.roomId
            });
            await this.sendRoomState(meta.roomId);
        }, {
            roomId: meta.roomId,
            userId: meta.userId,
            ...trace
        });
    }
    async promoteConnectedSpectatorsToParticipants(roomId) {
        if (!Number.isFinite(roomId) || roomId <= 0) {
            return;
        }
        let isPrivate = false;
        try {
            const state = await this.roomsService.getRoomPayload(roomId);
            isPrivate = Boolean(state?.room?.isPrivate);
        } catch  {
            isPrivate = false;
        }
        const connected = Array.from(this.clients.entries()).map(([socket, meta])=>({
                socket,
                meta
            })).filter(({ meta })=>meta.roomId === roomId).filter(({ meta })=>meta.silent !== true).filter(({ meta })=>meta.role === 'spectator');
        for (const { socket, meta } of connected){
            try {
                await this.roomsService.joinRoom(roomId, meta.userId, {
                    allowPrivate: isPrivate
                });
            } catch  {
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
                        message: 'Mode spectateur désactivé.'
                    }
                });
            } catch  {
            // ignore
            }
        }
    }
    async handleTogglePrivacy(meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.togglePrivacy.total', async ()=>{
            const room = await this.roomsService.togglePrivacy(meta.roomId, meta.userId, false);
            let state = await this.roomsService.updateRoomPayloadCache(meta.roomId, (payload)=>{
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
                room: state.room
            });
            await this.broadcastRoomIntent(meta.roomId, {
                type: 'announcement',
                payload: {
                    message: state.room.isPrivate ? 'Table privée.' : 'Table publique.'
                }
            });
        }, {
            roomId: meta.roomId,
            userId: meta.userId,
            ...trace
        });
    }
    async handleBotAdd(meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.bot.add.total', async ()=>{
            const bot = await this.botService.addBot(meta.roomId, meta.userId);
            await this.broadcast(meta.roomId, 'bot.added', {
                roomId: meta.roomId,
                bot: {
                    id: bot.id,
                    name: bot.name
                }
            });
            const updated = await this.tryUpdateRoomPayload(meta.roomId, (payload)=>{
                payload.room.bots = payload.room.bots ?? [];
                if (!payload.room.bots.some((b)=>b.id === bot.id)) {
                    payload.room.bots.push({
                        id: bot.id,
                        name: bot.name
                    });
                }
                payload.generatedAt = new Date().toISOString();
                return payload;
            });
            if (!updated) {
                await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
                await this.sendRoomState(meta.roomId);
            }
        }, {
            roomId: meta.roomId,
            userId: meta.userId,
            ...trace
        });
    }
    async handleBotRemove(meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.bot.remove.total', async ()=>{
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
                bot: {
                    id: bot.id,
                    name: bot.name
                },
                botId
            });
            const updated = await this.tryUpdateRoomPayload(meta.roomId, (payload)=>{
                payload.room.bots = (payload.room.bots ?? []).filter((b)=>b.id !== bot.id);
                payload.generatedAt = new Date().toISOString();
                return payload;
            });
            if (!updated) {
                await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
                await this.sendRoomState(meta.roomId);
            }
        }, {
            roomId: meta.roomId,
            userId: meta.userId,
            ...trace
        });
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
        const hasSpectatorFlag = payload != null && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'spectator');
        const spectatorRaw = payload?.spectator;
        const spectator = hasSpectatorFlag ? spectatorRaw === true || spectatorRaw === 1 || spectatorRaw === '1' || spectatorRaw === 'true' || spectatorRaw === 'yes' || spectatorRaw === 'y' : meta.role !== 'spectator';
        if (spectator) {
            // On se retire des participants (sans fermer la connexion) pour ne pas être compté comme joueur.
            // - Public: toujours
            // - Privé: uniquement pour le propriétaire (permet une partie 100% bots)
            if (!state.room.isPrivate || isOwner) {
                await this.roomsService.leaveRoom(meta.roomId, meta.userId, {
                    preserveRoom: true,
                    preserveOwner: isOwner
                });
            }
            meta.role = 'spectator';
        } else {
            // Participant: on (re)joint la table pour être compté comme joueur.
            // - Public: join standard
            // - Privé: join autorisé pour le propriétaire (pour revenir de "spectateur owner" -> "joueur")
            if (state.room.isPrivate) {
                if (isOwner) {
                    await this.roomsService.joinRoom(meta.roomId, meta.userId, {
                        allowPrivate: true
                    });
                } else {
                    const isParticipant = state.room.players?.some((p)=>p?.id === meta.userId) ?? false;
                    if (!isParticipant) {
                        throw new Error('Table privée: invitation requise');
                    }
                }
            } else {
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
                message: spectator ? 'Mode spectateur activé.' : 'Mode spectateur désactivé.'
            }
        });
        await this.broadcastRoomIntent(meta.roomId, {
            type: 'announcement',
            payload: {
                message: spectator ? 'Mode spectateur.' : 'Mode joueur.'
            }
        });
        await this.sendRoomState(meta.roomId);
    }
    async handleRoomCreate(client, meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.create.total', async ()=>{
            const gameType = typeof payload?.gameType === 'string' ? payload.gameType : '';
            const name = typeof payload?.name === 'string' ? payload.name : null;
            const maxPlayersRaw = payload?.maxPlayers ?? payload?.max ?? null;
            const maxPlayers = typeof maxPlayersRaw === 'number' ? maxPlayersRaw : Number.isFinite(parseInt(maxPlayersRaw, 10)) ? parseInt(maxPlayersRaw, 10) : null;
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
                manifest: manifest ? {
                    id: manifest.id,
                    name: manifest.name,
                    minPlayers: manifest.minPlayers ?? 2,
                    maxPlayers: manifest.maxPlayers ?? room.maxPlayers,
                    chatEnabled: manifest.chatEnabled !== false,
                    chatSoundsEnabled: manifest.chatSoundsEnabled !== false
                } : null,
                room: {
                    id: room.id,
                    name: room.name,
                    isPrivate: room.isPrivate,
                    maxPlayers: room.maxPlayers,
                    status: room.status,
                    gameType: room.gameType,
                    startedAt: room.startedAt ? room.startedAt.toISOString() : null,
                    counts: {
                        players: 1,
                        spectators: 0
                    },
                    owner: {
                        id: meta.userId,
                        username: meta.username
                    },
                    players: [
                        {
                            id: meta.userId,
                            username: meta.username
                        }
                    ],
                    spectators: [],
                    bots: []
                },
                generatedAt: new Date().toISOString()
            };
            const message = {
                type: 'room.created',
                roomId: room.id,
                payload: this.withAllowedActionsForClient(state, meta)
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
            ...trace
        });
    }
    async handleRoomJoin(client, meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.join.total', async ()=>{
            const roomId = Number(payload?.roomId ?? payload?.room ?? 0);
            const spectatorRaw = payload?.spectator;
            const spectator = spectatorRaw === true || spectatorRaw === 1 || spectatorRaw === '1' || spectatorRaw === 'true' || spectatorRaw === 'yes' || spectatorRaw === 'y';
            const silentRaw = payload?.silent;
            const hiddenRaw = payload?.hidden;
            const silent = silentRaw === true || silentRaw === 1 || silentRaw === '1' || silentRaw === 'true' || silentRaw === 'yes' || silentRaw === 'y' || hiddenRaw === true || hiddenRaw === 1 || hiddenRaw === '1' || hiddenRaw === 'true' || hiddenRaw === 'yes' || hiddenRaw === 'y';
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
                } catch (err) {
                    // Table démarrée: autoriser un "join" en spectateur plutôt que refuser,
                    // à condition que l'utilisateur ait le droit de spectate (tables privées: invite).
                    const reason = err.message;
                    const state = await this.roomsService.getRoomPayload(roomId);
                    const isOwner = state.room.owner?.id === meta.userId;
                    const isParticipant = state.room.players?.some((p)=>p?.id === meta.userId) ?? false;
                    const started = (state.room.status || '').toLowerCase() === 'started' || Boolean(state.room.startedAt);
                    if (started) {
                        // Rejoin: si l'utilisateur est déjà joueur (owner/participant),
                        // on accepte la connexion en "participant" même si joinRoom() refuse.
                        if (isOwner || isParticipant) {
                        // no-op
                        } else {
                            const allowed = await this.canSpectate(roomId, meta.userId);
                            if (!allowed) {
                                throw new Error(reason);
                            }
                            effectiveSpectator = true;
                        }
                    } else {
                        throw err;
                    }
                }
            }
            const previousRoomId = meta.roomId;
            const previousRole = meta.role;
            const previousSilent = meta.silent === true;
            // Rebind socket room membership if:
            // - we switch rooms, or
            // - we stay in the same room but change silent/normal mode
            // (otherwise the socket may end up in the wrong set and not receive updates).
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
                } else {
                    if (!this.rooms.has(roomId)) {
                        this.rooms.set(roomId, new Set());
                    }
                    this.rooms.get(roomId).add(client);
                }
            }
            meta.roomId = roomId;
            meta.role = effectiveSpectator ? 'spectator' : 'participant';
            meta.silent = effectiveSilent;
            this.realtimeTracker.setSocketParticipantRoom(client, meta.role === 'participant' && meta.silent !== true ? meta.roomId : null);
            if (effectiveSilent) {
                await this.sendRoomStateToClient(client, roomId, {
                    includeRealtimePlayers: true,
                    includeHiddenSelf: {
                        userId: meta.userId,
                        username: meta.username
                    }
                });
            } else {
                await this.sendRoomState(roomId);
            }
            if (Number.isFinite(previousRoomId) && previousRoomId > 0 && previousRoomId !== roomId) {
                await this.leavePreviousRoomOnSwitch(previousRoomId, meta.userId, previousRole);
            }
        }, {
            userId: meta.userId,
            roomId: payload?.roomId ?? payload?.room ?? null,
            ...trace
        });
    }
    async leavePreviousRoomOnSwitch(previousRoomId, userId, previousRole) {
        try {
            // Quand un utilisateur rejoint une nouvelle table (même en spectateur),
            // il ne doit plus être considéré comme présent sur l'ancienne.
            // Exigence : si aucun humain restant -> supprimer; sinon transférer le propriétaire.
            if (previousRole === 'spectator') {
                await this.roomsService.transferOwnerIfCurrent(previousRoomId, userId);
            }
            await this.roomsService.leaveRoom(previousRoomId, userId, {
                preserveRoom: false,
                disconnectOnly: false
            });
        } catch  {
        // best effort: ne pas bloquer le join.
        }
        try {
            await this.sendRoomState(previousRoomId);
        } catch  {
        // ignore
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
        const spectators = (0, _roomroster.listVisibleSpectators)(this.clients.values(), roomId);
        const isOnTable = (state?.room?.players?.some((p)=>p?.id === targetUserId) ?? false) || spectators.some((s)=>s?.id === targetUserId) || this.hasUserConnections(roomId, targetUserId);
        if (!isOnTable) {
            throw new Error('Utilisateur introuvable sur la table');
        }
        if (ban) {
            this.roomsService.ban(roomId, targetUserId);
        }
        try {
            await this.roomsService.leaveRoom(roomId, targetUserId, {
                preserveRoom: true,
                disconnectOnly: false
            });
        } catch  {
        // ignore
        }
        const message = ban ? 'Vous avez ete banni de cette table.' : 'Vous avez ete exclu de cette table.';
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
        const spectators = (0, _roomroster.listVisibleSpectators)(this.clients.values(), roomId);
        const isOnTable = (state?.room?.players?.some((p)=>p?.id === newOwnerId) ?? false) || spectators.some((s)=>s?.id === newOwnerId) || this.hasUserConnections(roomId, newOwnerId);
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
        if (a) sockets.push(...Array.from(a));
        if (b) sockets.push(...Array.from(b));
        for (const socket of sockets){
            const meta = this.clients.get(socket);
            if (!meta || meta.roomId !== roomId || meta.userId !== userId) {
                continue;
            }
            try {
                this.safeSend(socket, {
                    type: 'error',
                    roomId,
                    payload: {
                        message
                    }
                });
            } catch  {
            // ignore
            }
            // IMPORTANT: garder la socket ouverte (cycle de vie de l'app) et simplement
            // la détacher de la table. Le client peut ensuite rejoindre une autre table.
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
                    payload: leftPayload
                });
            } catch  {
                this.safeSend(socket, {
                    type: 'room.deleted',
                    roomId
                });
            }
        }
        if (a && a.size === 0) this.rooms.delete(roomId);
        if (b && b.size === 0) this.silentRooms.delete(roomId);
    }
    isAdmin(roles) {
        if (!roles || roles.length === 0) return false;
        return roles.some((r)=>{
            const v = (r || '').trim().toLowerCase();
            return v === 'role_admin' || v === 'admin' || v === 'administrator';
        });
    }
    hasUserConnections(roomId, userId) {
        const set = this.rooms.get(roomId);
        if (set) {
            for (const socket of set.values()){
                const meta = this.clients.get(socket);
                if (meta?.userId === userId && meta.roomId === roomId) return true;
            }
        }
        const silentSet = this.silentRooms.get(roomId);
        if (silentSet) {
            for (const socket of silentSet.values()){
                const meta = this.clients.get(socket);
                if (meta?.userId === userId && meta.roomId === roomId) return true;
            }
        }
        return false;
    }
    async handleSetAmbience(client, meta, payload, receivedAtMs) {
        const trace = this.extractTraceMeta(payload, receivedAtMs);
        await this.perf.measure('ws.room.setAmbience.total', async ()=>{
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
                'TableAmbience20'
            ]);
            if (soundId != null && !allowed.has(soundId)) {
                await this.sendError(client, `Ambiance invalide: ${soundId}`);
                return;
            }
            const room = await this.roomsService.requireRoomForOwnerAction(meta.roomId, meta.userId);
            room.tableAmbienceSoundId = soundId;
            await this.roomsService.saveRoom(room);
            const updated = await this.tryUpdateRoomPayload(meta.roomId, (p)=>{
                p.room.tableAmbienceSoundId = soundId;
                p.generatedAt = new Date().toISOString();
                return p;
            });
            if (!updated) {
                await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
                await this.sendRoomState(meta.roomId);
            }
        }, {
            roomId: meta.roomId,
            userId: meta.userId,
            ...trace
        });
    }
    buildParticipantLeaveKey(roomId, userId) {
        return `${roomId}:${userId}`;
    }
    clearPendingParticipantLeave(roomId, userId) {
        const key = this.buildParticipantLeaveKey(roomId, userId);
        const existing = this.pendingParticipantLeaves.get(key);
        if (!existing) return;
        clearTimeout(existing);
        this.pendingParticipantLeaves.delete(key);
    }
    scheduleDelayedParticipantLeave(roomId, userId) {
        const key = this.buildParticipantLeaveKey(roomId, userId);
        if (this.pendingParticipantLeaves.has(key)) return;
        const timeout = setTimeout(()=>{
            this.pendingParticipantLeaves.delete(key);
            if (this.hasUserConnections(roomId, userId)) return;
            this.roomsService.leaveRoom(roomId, userId, {
                preserveRoom: true,
                disconnectOnly: false
            }).then(()=>this.sendRoomState(roomId)).catch(()=>{});
        }, this.participantDisconnectGraceMs);
        this.pendingParticipantLeaves.set(key, timeout);
    }
    async canSpectate(roomId, userId) {
        try {
            if (this.roomsService.isBanned(roomId, userId)) {
                return false;
            }
            const state = await this.roomsService.getRoomPayload(roomId);
            if (!state?.room) return false;
            if (!state.room.isPrivate) {
                return true;
            }
            const isOwner = state.room.owner?.id === userId;
            const isParticipant = state.room.players?.some((p)=>p?.id === userId) ?? false;
            if (isOwner || isParticipant) return true;
            const started = (state.room.status || '').toLowerCase() === 'started' || Boolean(state.room.startedAt);
            return started && this.invites.canSpectate(roomId, userId);
        } catch  {
            return false;
        }
    }
    constructor(roomsService, botService, auth, catalog, perf, invites, clientUpdates, wsTickets, realtimeTracker){
        this.roomsService = roomsService;
        this.botService = botService;
        this.auth = auth;
        this.catalog = catalog;
        this.perf = perf;
        this.invites = invites;
        this.clientUpdates = clientUpdates;
        this.wsTickets = wsTickets;
        this.realtimeTracker = realtimeTracker;
        this.clients = new Map();
        this.rooms = new Map();
        this.silentRooms = new Map();
        this.logger = new _common.Logger(RoomGateway.name);
        this.heartbeats = new Map();
        this.lastPong = new WeakMap();
        this.pingIntervalMs = 25_000;
        this.lastChatSentAt = new WeakMap();
        this.messageQueueByClient = new WeakMap();
        this.roomChat = new Map();
        this.roomChatLimit = 120;
        this.chatCooldownMs = 350;
        this.chatMaxLength = 300;
        this.lastRoomStatusByRoomId = new Map();
        this.lastRoomSnapshotByRoomId = new Map();
        this.participantDisconnectGraceMs = 60_000;
        this.pendingParticipantLeaves = new Map();
        // Permet au backend (ex: moteur de jeu) de notifier les clients room sans dépendre du Gateway.
        this.roomsService.setRealtimeNotifier(async (roomId)=>{
            await this.broadcast(roomId, 'state-updated', {
                roomId
            });
            await this.sendRoomState(roomId);
        });
        // Permet à l'admin (via RoomService) de forcer la suppression d'une room
        // en déconnectant tous les clients WS connectés à cette table.
        this.roomsService.setRoomDeletedNotifier(async (roomId)=>{
            this.roomChat.delete(roomId);
            this.forceDisconnectRoomClients(roomId);
        });
    // Auth JWT is handled by WsJwtAuthService (RS256/HS256 depending on configuration).
    }
};
_ts_decorate([
    (0, _websockets.WebSocketServer)(),
    _ts_metadata("design:type", typeof _ws.Server === "undefined" ? Object : _ws.Server)
], RoomGateway.prototype, "server", void 0);
_ts_decorate([
    (0, _websockets.SubscribeMessage)('message'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _ws.WebSocket === "undefined" ? Object : _ws.WebSocket,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleMessage", null);
RoomGateway = _ts_decorate([
    (0, _websockets.WebSocketGateway)({
        path: '/ws'
    }),
    _ts_param(1, (0, _common.Inject)((0, _common.forwardRef)(()=>_botservice.BotService))),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _roomservice.RoomService === "undefined" ? Object : _roomservice.RoomService,
        typeof _botservice.BotService === "undefined" ? Object : _botservice.BotService,
        typeof _wsjwtauthservice.WsJwtAuthService === "undefined" ? Object : _wsjwtauthservice.WsJwtAuthService,
        typeof _catalogservice.CatalogService === "undefined" ? Object : _catalogservice.CatalogService,
        typeof _perfmetricsservice.PerfMetricsService === "undefined" ? Object : _perfmetricsservice.PerfMetricsService,
        typeof _roominviteservice.RoomInviteService === "undefined" ? Object : _roominviteservice.RoomInviteService,
        typeof _clientupdatesservice.ClientUpdatesService === "undefined" ? Object : _clientupdatesservice.ClientUpdatesService,
        typeof _wsticketauthservice.WsTicketAuthService === "undefined" ? Object : _wsticketauthservice.WsTicketAuthService,
        typeof _roomrealtimetrackerservice.RoomRealtimeTrackerService === "undefined" ? Object : _roomrealtimetrackerservice.RoomRealtimeTrackerService
    ])
], RoomGateway);
