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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultRoomSnapshotsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const vault_room_snapshot_entity_1 = require("../entities/vault-room-snapshot.entity");
const room_service_1 = require("../../room/services/room.service");
const bot_service_1 = require("../../bot/services/bot.service");
const room_bot_entity_1 = require("../../room/entities/room-bot.entity");
const game_engine_service_1 = require("../../game/engine/services/game-engine.service");
const game_registry_service_1 = require("../../game/engine/services/game-registry.service");
const notification_service_1 = require("../../notification/services/notification.service");
const presence_service_1 = require("../../presence/services/presence.service");
let VaultRoomSnapshotsService = class VaultRoomSnapshotsService {
    snapshots;
    roomBots;
    rooms;
    bots;
    engine;
    registry;
    notifications;
    presence;
    constructor(snapshots, roomBots, rooms, bots, engine, registry, notifications, presence) {
        this.snapshots = snapshots;
        this.roomBots = roomBots;
        this.rooms = rooms;
        this.bots = bots;
        this.engine = engine;
        this.registry = registry;
        this.notifications = notifications;
        this.presence = presence;
    }
    async list(ownerUserId) {
        const items = await this.snapshots.find({
            where: { ownerUserId },
            order: { createdAt: 'DESC' },
            take: 50,
        });
        return items.map((s) => ({
            id: s.id,
            name: s.name,
            roomName: s.roomName,
            gameType: s.gameType,
            playersLabel: s.playersLabel,
            createdAt: s.createdAt.toISOString(),
        }));
    }
    async delete(ownerUserId, snapshotId) {
        const id = String(snapshotId ?? '').trim();
        if (!id)
            throw new common_1.BadRequestException('id requis');
        const res = await this.snapshots.delete({ id, ownerUserId });
        return (res.affected ?? 0) > 0;
    }
    async save(ownerUserId, roomId, snapshotId) {
        if (!Number.isFinite(roomId) || roomId <= 0) {
            throw new common_1.BadRequestException('roomId invalide');
        }
        const payload = await this.rooms.getRoomPayload(roomId);
        const isOwner = payload?.room?.owner?.id === ownerUserId;
        const isPlayer = payload?.room?.players?.some((p) => p?.id === ownerUserId);
        if (!isOwner && !isPlayer) {
            throw new common_1.BadRequestException("Vous n'êtes pas sur cette table.");
        }
        if (!isOwner) {
            throw new common_1.BadRequestException('Seul le propriétaire de la table peut sauvegarder.');
        }
        const started = String(payload?.room?.status ?? '').toLowerCase() === 'started' ||
            Boolean(payload?.room?.startedAt);
        if (!started) {
            throw new common_1.BadRequestException('Sauvegarde impossible : la partie doit être démarrée.');
        }
        const gameType = String(payload?.room?.gameType ?? '').trim();
        if (!gameType) {
            throw new common_1.BadRequestException('Type de jeu invalide');
        }
        const state = await this.engine.exportInternalState(roomId, gameType);
        if (!state) {
            throw new common_1.BadRequestException("État de jeu introuvable (la table n'est peut-être pas démarrée).");
        }
        const gameName = String(this.registry.getHandler(gameType)?.displayName ?? '').trim() ||
            gameType;
        const dateFr = new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Europe/Paris',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(new Date());
        const players = (payload.room.players ?? [])
            .map((p) => String(p?.username ?? '').trim())
            .filter((u) => u.length > 0);
        const playersShort = players.slice(0, 6).join(', ') + (players.length > 6 ? ', …' : '');
        const name = `${gameName}, ${dateFr} (${playersShort || 'joueurs'})`.slice(0, 200);
        const playersLabel = players.join(', ').slice(0, 255);
        const snapshot = {
            version: 1,
            savedAt: new Date().toISOString(),
            room: {
                name: String(payload.room.name ?? '').trim() || `Table ${gameType}`,
                isPrivate: Boolean(payload.room.isPrivate),
                maxPlayers: Number(payload.room.maxPlayers ?? 4) || 4,
                tableAmbienceSoundId: typeof payload.room?.tableAmbienceSoundId === 'string'
                    ? String(payload.room.tableAmbienceSoundId).trim() || null
                    : null,
            },
            roster: {
                ownerUserId: typeof payload.room.owner?.id === 'number'
                    ? payload.room.owner.id
                    : null,
                players: (payload.room.players ?? []).map((p) => ({
                    id: p.id,
                    username: p.username,
                })),
                spectators: (payload.room.spectators ?? []).map((s) => ({
                    id: s.id,
                    username: s.username,
                })),
                bots: (payload.room.bots ?? []).map((b) => ({
                    id: b.id,
                    name: b.name,
                })),
            },
            game: { gameType, state },
        };
        const requestedIdRaw = String(snapshotId ?? '').trim();
        let requestedId = requestedIdRaw;
        try {
            const room = await this.rooms.requireRoomForOwnerAction(roomId, ownerUserId);
            const restoredFrom = typeof room.restoredFromSnapshotId === 'string'
                ? String(room.restoredFromSnapshotId).trim() || ''
                : '';
            const restoredOwner = typeof room.restoredOwnerUserId === 'number'
                ? Number(room.restoredOwnerUserId)
                : null;
            if (!requestedId &&
                restoredFrom &&
                (restoredOwner === ownerUserId || restoredOwner == null)) {
                const exists = await this.snapshots.findOne({
                    where: { id: restoredFrom, ownerUserId },
                    select: ['id'],
                });
                if (exists) {
                    requestedId = restoredFrom;
                }
            }
        }
        catch {
        }
        let entity;
        if (requestedId) {
            const existing = await this.snapshots.findOne({
                where: { id: requestedId, ownerUserId },
            });
            if (existing) {
                existing.name = name;
                existing.gameType = gameType;
                existing.roomName = snapshot.room.name.slice(0, 255);
                existing.playersLabel = playersLabel;
                existing.snapshotJson = JSON.stringify(snapshot);
                existing.createdAt = new Date();
                entity = await this.snapshots.save(existing);
            }
            else {
                entity = this.snapshots.create({
                    id: (0, crypto_1.randomUUID)(),
                    ownerUserId,
                    name,
                    gameType,
                    roomName: snapshot.room.name.slice(0, 255),
                    playersLabel,
                    snapshotJson: JSON.stringify(snapshot),
                    createdAt: new Date(),
                });
                await this.snapshots.save(entity);
            }
        }
        else {
            entity = this.snapshots.create({
                id: (0, crypto_1.randomUUID)(),
                ownerUserId,
                name,
                gameType,
                roomName: snapshot.room.name.slice(0, 255),
                playersLabel,
                snapshotJson: JSON.stringify(snapshot),
                createdAt: new Date(),
            });
            await this.snapshots.save(entity);
        }
        await this.rooms.adminDestroyRoom(roomId);
        return { id: entity.id };
    }
    async restore(ownerUserId, snapshotId) {
        const id = String(snapshotId ?? '').trim();
        if (!id)
            throw new common_1.BadRequestException('id requis');
        const entity = await this.snapshots.findOne({ where: { id, ownerUserId } });
        if (!entity) {
            throw new common_1.BadRequestException('Sauvegarde introuvable');
        }
        const snapshot = this.parseSnapshot(entity.snapshotJson);
        const humans = (snapshot.roster.players ?? []).filter((p) => typeof p?.id === 'number' && p.id > 0);
        if (humans.length === 0) {
            throw new common_1.BadRequestException('Sauvegarde invalide : aucun joueur');
        }
        const rosterHumans = this.uniqueUsers([
            ...humans,
            ...(Number.isFinite(snapshot.roster.ownerUserId)
                ? [
                    {
                        id: Number(snapshot.roster.ownerUserId),
                        username: 'proprietaire',
                    },
                ]
                : []),
        ]);
        const notInTavern = rosterHumans.filter((p) => !this.presence.isUserInTavern(p.id));
        if (notInTavern.length > 0) {
            throw new common_1.BadRequestException(`Restauration impossible : joueurs absents de la taverne : ${notInTavern
                .map((p) => String(p.username ?? `joueur ${p.id}`))
                .join(', ')}.`);
        }
        const unavailable = [];
        for (const p of rosterHumans) {
            if (p.id === ownerUserId)
                continue;
            const activeRoom = await this.rooms.findLatestActiveRoomForUser(p.id);
            if (activeRoom?.roomId && activeRoom.roomId > 0) {
                unavailable.push(String(p.username ?? `joueur ${p.id}`));
            }
        }
        if (unavailable.length > 0) {
            throw new common_1.BadRequestException(`Restauration impossible : joueurs encore en table : ${unavailable.join(', ')}.`);
        }
        const gameType = snapshot.game.gameType;
        const roomName = snapshot.room.name;
        const created = await this.rooms.createRoom(ownerUserId, gameType, `${roomName} (restaurée)`, snapshot.room.maxPlayers, snapshot.room.isPrivate);
        try {
            const room = await this.rooms.requireRoomForOwnerAction(created.id, ownerUserId);
            room.restoredFromSnapshotId = id;
            room.restoredOwnerUserId = ownerUserId;
            await this.rooms.saveRoom(room);
        }
        catch {
        }
        for (const p of humans) {
            if (p.id === ownerUserId)
                continue;
            await this.rooms.joinRoom(created.id, p.id, {
                allowPrivate: snapshot.room.isPrivate,
            });
        }
        const oldBots = snapshot.roster.bots ?? [];
        const botIdMap = new Map();
        for (const b of oldBots) {
            const added = await this.bots.addBotSystem(created.id);
            try {
                const desired = String(b?.name ?? '').trim();
                if (desired) {
                    added.name = desired;
                    await this.roomBots.save(added);
                }
            }
            catch {
            }
            const oldPlayerId = -Math.abs(Number(b.id));
            const newPlayerId = -Math.abs(Number(added.id));
            botIdMap.set(oldPlayerId, newPlayerId);
        }
        try {
            const room = await this.rooms.requireRoomForOwnerAction(created.id, ownerUserId);
            room.tableAmbienceSoundId = snapshot.room.tableAmbienceSoundId;
            await this.rooms.saveRoom(room);
            await this.rooms.invalidateRoomPayloadCache(created.id);
        }
        catch {
        }
        const started = await this.rooms.startRoom(created.id, ownerUserId);
        const startedAt = started.startedAt
            ? started.startedAt.toISOString()
            : null;
        const runId = Number.isFinite(started.runId)
            ? started.runId
            : null;
        const restored = this.remapState(snapshot.game.state, {
            roomId: created.id,
            roomOwnerId: ownerUserId,
            roomStartedAt: startedAt,
            roomRunId: runId,
            botIdMap,
            botNamesByNewId: new Map(Array.from(botIdMap.entries()).map(([_, newId]) => {
                const old = oldBots.find((b) => -Math.abs(Number(b.id)) === _);
                return [newId, old?.name ?? 'Bot'];
            })),
        });
        await this.engine.restoreInternalState(created.id, gameType, restored);
        for (const p of humans) {
            await this.notifications.notifyUser(p.id, 'rooms.restore.ready', {
                roomId: created.id,
                roomName: `${roomName} (restaurée)`,
                by: { id: ownerUserId },
            });
        }
        return { roomId: created.id };
    }
    async abandonRestoredRoom(ownerUserId, roomId) {
        const id = typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
            ? Math.floor(roomId)
            : 0;
        if (id <= 0) {
            throw new common_1.BadRequestException('roomId invalide');
        }
        let snapshotId = null;
        try {
            const room = await this.rooms.requireRoomForOwnerAction(id, ownerUserId);
            snapshotId =
                typeof room.restoredFromSnapshotId === 'string'
                    ? String(room.restoredFromSnapshotId).trim() || null
                    : null;
            const restoredOwner = typeof room.restoredOwnerUserId === 'number'
                ? Number(room.restoredOwnerUserId)
                : null;
            if (!snapshotId || restoredOwner !== ownerUserId) {
                return false;
            }
        }
        catch {
            return false;
        }
        try {
            await this.rooms.adminDestroyRoom(id);
        }
        catch {
            return false;
        }
        return true;
    }
    parseSnapshot(raw) {
        let parsed;
        try {
            parsed = JSON.parse(String(raw ?? ''));
        }
        catch {
            throw new common_1.BadRequestException('Sauvegarde corrompue (JSON invalide).');
        }
        if (!parsed || parsed.version !== 1) {
            throw new common_1.BadRequestException('Sauvegarde incompatible.');
        }
        return parsed;
    }
    remapState(state, opts) {
        const replaceId = (value) => {
            if (typeof value === 'number' && opts.botIdMap.has(value)) {
                return opts.botIdMap.get(value);
            }
            return value;
        };
        const deep = (value) => {
            if (value == null)
                return value;
            if (typeof value === 'number')
                return replaceId(value);
            if (typeof value === 'string')
                return value;
            if (typeof value === 'boolean')
                return value;
            if (Array.isArray(value))
                return value.map(deep);
            if (typeof value === 'object') {
                const out = {};
                for (const [k, v] of Object.entries(value)) {
                    const maybeId = Number(k);
                    const key = Number.isFinite(maybeId) && opts.botIdMap.has(maybeId)
                        ? String(opts.botIdMap.get(maybeId))
                        : k;
                    out[key] = deep(v);
                }
                return out;
            }
            return value;
        };
        const cloned = deep(state);
        cloned.status = 'started';
        if (Array.isArray(state?.log)) {
            cloned.log = deep(state.log);
        }
        const meta = typeof cloned.metadata === 'object' && cloned.metadata
            ? cloned.metadata
            : {};
        meta.roomId = opts.roomId;
        meta.roomOwnerId = opts.roomOwnerId;
        meta.roomStartedAt = opts.roomStartedAt;
        meta.roomRunId = opts.roomRunId;
        cloned.metadata = meta;
        if (Array.isArray(cloned.players)) {
            cloned.players = cloned.players.map((p) => {
                const nextId = typeof p?.id === 'number' ? replaceId(p.id) : p?.id;
                const nextName = typeof nextId === 'number' &&
                    nextId < 0 &&
                    opts.botNamesByNewId.has(nextId)
                    ? opts.botNamesByNewId.get(nextId)
                    : p?.username;
                return { ...p, id: nextId, username: nextName };
            });
        }
        if (cloned.turn && typeof cloned.turn.currentPlayerId === 'number') {
            cloned.turn = {
                ...cloned.turn,
                currentPlayerId: replaceId(cloned.turn.currentPlayerId),
            };
        }
        return cloned;
    }
    uniqueUsers(users) {
        const map = new Map();
        for (const user of users) {
            if (!user || !Number.isFinite(user.id) || user.id <= 0)
                continue;
            const id = Math.floor(user.id);
            if (map.has(id))
                continue;
            const username = String(user.username ?? '').trim();
            map.set(id, username || `joueur ${id}`);
        }
        return Array.from(map.entries()).map(([id, username]) => ({
            id,
            username,
        }));
    }
};
exports.VaultRoomSnapshotsService = VaultRoomSnapshotsService;
exports.VaultRoomSnapshotsService = VaultRoomSnapshotsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(vault_room_snapshot_entity_1.VaultRoomSnapshotEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(room_bot_entity_1.RoomBot)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        room_service_1.RoomService,
        bot_service_1.BotService,
        game_engine_service_1.GameEngineService,
        game_registry_service_1.GameRegistryService,
        notification_service_1.NotificationService,
        presence_service_1.PresenceService])
], VaultRoomSnapshotsService);
//# sourceMappingURL=vault-room-snapshots.service.js.map