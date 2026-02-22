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
var RoomService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const room_entity_1 = require("../entities/room.entity");
const room_participant_entity_1 = require("../entities/room-participant.entity");
const user_entity_1 = require("../../user/entities/user.entity");
const vault_room_snapshot_entity_1 = require("../../vault/entities/vault-room-snapshot.entity");
const bot_service_1 = require("../../bot/services/bot.service");
const presence_service_1 = require("../../presence/services/presence.service");
const room_status_constants_1 = require("../constants/room-status.constants");
const catalog_service_1 = require("../../catalog/services/catalog.service");
const game_stats_service_1 = require("../../stats/services/game-stats.service");
const room_realtime_tracker_service_1 = require("./room-realtime-tracker.service");
const redis_client_factory_1 = require("../../common/redis/redis-client.factory");
let RoomService = RoomService_1 = class RoomService {
    rooms;
    participants;
    vaultSnapshots;
    users;
    botService;
    presenceService;
    catalog;
    stats;
    realtimeTracker;
    config;
    redisFactory;
    realtimeNotifier;
    directoryNotifier;
    logger = new common_1.Logger(RoomService_1.name);
    redis = null;
    roomPayloadRedisPrefix = 'room:payload:';
    roomPayloadTtlSeconds;
    roomBans = new Map();
    static isAdminRoles(roles) {
        const list = Array.isArray(roles) ? roles : [];
        return list.includes('ROLE_ADMIN') || list.includes('admin');
    }
    setRealtimeNotifier(fn) {
        this.realtimeNotifier = fn;
    }
    setRoomDeletedNotifier(fn) {
        if (typeof fn !== 'function') {
            return;
        }
        this.ensureRoomDeletedNotifiers().push(fn);
    }
    setDirectoryNotifier(fn) {
        this.directoryNotifier = fn;
    }
    async notifyRoomStateUpdated(roomId) {
        try {
            await this.realtimeNotifier?.(roomId);
        }
        catch {
        }
    }
    async adminDestroyRoom(roomId) {
        const id = typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
            ? Math.floor(roomId)
            : 0;
        if (id <= 0) {
            throw new common_1.BadRequestException('roomId invalide.');
        }
        const existing = await this.rooms.findOne({
            where: { id },
            select: ['id'],
        });
        if (!existing) {
            throw new common_1.NotFoundException('Room introuvable.');
        }
        for (const notify of this.ensureRoomDeletedNotifiers()) {
            try {
                await notify(id);
            }
            catch {
            }
        }
        await this.rooms.delete(id);
        this.roomBans.delete(id);
        await this.invalidateRoomPayloadCache(id);
        this.notifyDirectoryChanged(id, 'deleted');
        this.presenceService.broadcastPresence();
        return { ok: true, roomId: id };
    }
    isBanned(roomId, userId) {
        const id = typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
            ? Math.floor(roomId)
            : 0;
        const uid = typeof userId === 'number' && Number.isFinite(userId) && userId > 0
            ? Math.floor(userId)
            : 0;
        if (id <= 0 || uid <= 0)
            return false;
        return this.roomBans.get(id)?.has(uid) ?? false;
    }
    ban(roomId, userId) {
        const id = typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
            ? Math.floor(roomId)
            : 0;
        const uid = typeof userId === 'number' && Number.isFinite(userId) && userId > 0
            ? Math.floor(userId)
            : 0;
        if (id <= 0 || uid <= 0)
            return;
        const set = this.roomBans.get(id) ?? new Set();
        set.add(uid);
        this.roomBans.set(id, set);
    }
    unban(roomId, userId) {
        const id = typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
            ? Math.floor(roomId)
            : 0;
        const uid = typeof userId === 'number' && Number.isFinite(userId) && userId > 0
            ? Math.floor(userId)
            : 0;
        if (id <= 0 || uid <= 0)
            return;
        const set = this.roomBans.get(id);
        if (!set)
            return;
        set.delete(uid);
        if (set.size === 0)
            this.roomBans.delete(id);
    }
    async setOwner(roomId, userId, newOwnerId) {
        const room = await this.requireRoom(roomId);
        this.ensureOwner(room, userId);
        const user = await this.requireUser(newOwnerId);
        room.owner = user;
        await this.rooms.save(room);
        await this.invalidateRoomPayloadCache(room.id);
        this.notifyDirectoryChanged(room.id, 'owner');
        this.presenceService.broadcastPresence();
        return room;
    }
    async requireRoomForOwnerAction(roomId, userId) {
        const room = await this.requireRoom(roomId);
        this.ensureOwner(room, userId);
        return room;
    }
    async saveRoom(room) {
        const saved = await this.rooms.save(room);
        await this.invalidateRoomPayloadCache(saved.id);
        this.notifyDirectoryChanged(saved.id, 'updated');
        return saved;
    }
    async adminListRooms(opts) {
        const includePrivate = opts?.includePrivate !== false;
        const joinableOnly = opts?.joinableOnly === true;
        const includeStarted = joinableOnly ? false : opts?.includeStarted === true;
        const limit = Math.min(Math.max(1, opts?.limit ?? 200), 1000);
        const qb = this.rooms
            .createQueryBuilder('room')
            .leftJoinAndSelect('room.owner', 'owner')
            .leftJoinAndSelect('room.participants', 'participant', 'participant.leftAt IS NULL')
            .leftJoinAndSelect('participant.user', 'participantUser')
            .leftJoinAndSelect('room.bots', 'bot')
            .orderBy('room.id', 'DESC')
            .limit(limit);
        if (!includePrivate) {
            qb.where('room.isPrivate = :isPrivate', { isPrivate: false });
        }
        else {
            qb.where('1=1');
        }
        if (!includeStarted) {
            qb.andWhere('room.startedAt IS NULL');
        }
        const rooms = await qb.getMany();
        const items = rooms.map((r) => ({
            id: r.id,
            name: r.name ?? '',
            gameType: r.gameType ?? '',
            status: r.status ?? '',
            isPrivate: Boolean(r.isPrivate),
            maxPlayers: Number(r.maxPlayers ?? 0) || 0,
            playersCount: r.participants?.length ?? 0,
            botsCount: r.bots?.length ?? 0,
            ownerUsername: r.owner?.username ?? null,
            activePlayers: this.realtimeTracker.countActivePlayers(r.id),
        }));
        if (!joinableOnly) {
            return { items };
        }
        const openStatuses = new Set(room_status_constants_1.OPEN_ROOM_STATUSES.map((s) => (s ?? '').toLowerCase()));
        return {
            items: items.filter((r) => {
                const status = (r.status ?? '').toLowerCase();
                return openStatuses.has(status) && r.activePlayers > 0;
            }),
        };
    }
    async adminCleanupRooms(opts) {
        const includePrivate = opts?.includePrivate === true;
        const includeStarted = opts?.includeStarted === true;
        const dryRun = opts?.dryRun === true;
        const excludeActivePlayers = opts?.excludeActivePlayers !== false;
        const limit = Math.min(Math.max(1, opts?.limit ?? 1000), 5000);
        const qb = this.rooms
            .createQueryBuilder('room')
            .select(['room.id'])
            .orderBy('room.id', 'ASC');
        if (!includePrivate) {
            qb.where('room.is_private = :isPrivate', { isPrivate: false });
        }
        else {
            qb.where('1=1');
        }
        if (!includeStarted) {
            qb.andWhere('room.started_at IS NULL');
            const statuses = room_status_constants_1.OPEN_ROOM_STATUSES.map((s) => s.toLowerCase());
            qb.andWhere('LOWER(room.status) IN (:...statuses)', { statuses });
        }
        const olderThanMinutes = typeof opts?.olderThanMinutes === 'number' &&
            Number.isFinite(opts.olderThanMinutes) &&
            opts.olderThanMinutes > 0
            ? Math.floor(opts.olderThanMinutes)
            : null;
        if (olderThanMinutes) {
            const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
            qb.andWhere('room.created_at < :cutoff', { cutoff });
        }
        qb.limit(limit);
        const rows = await qb.getRawMany();
        const roomIds = rows
            .map((r) => Number(r?.room_id ?? r?.id ?? 0))
            .filter((id) => Number.isFinite(id) && id > 0);
        const filteredRoomIds = excludeActivePlayers
            ? roomIds.filter((id) => !this.realtimeTracker.hasActivePlayers(id))
            : roomIds;
        if (dryRun) {
            return {
                matched: filteredRoomIds.length,
                deleted: 0,
                roomIds: filteredRoomIds,
            };
        }
        if (filteredRoomIds.length === 0) {
            return { matched: 0, deleted: 0, roomIds: [] };
        }
        await this.rooms.delete(filteredRoomIds);
        for (const id of filteredRoomIds) {
            await this.invalidateRoomPayloadCache(id);
            this.notifyDirectoryChanged(id, 'deleted');
        }
        this.presenceService.broadcastPresence();
        return {
            matched: filteredRoomIds.length,
            deleted: filteredRoomIds.length,
            roomIds: filteredRoomIds,
        };
    }
    notifyDirectoryChanged(roomId, reason) {
        try {
            void this.directoryNotifier?.(roomId, reason);
        }
        catch {
        }
    }
    constructor(rooms, participants, vaultSnapshots, users, botService, presenceService, catalog, stats, realtimeTracker, config, redisFactory) {
        this.rooms = rooms;
        this.participants = participants;
        this.vaultSnapshots = vaultSnapshots;
        this.users = users;
        this.botService = botService;
        this.presenceService = presenceService;
        this.catalog = catalog;
        this.stats = stats;
        this.realtimeTracker = realtimeTracker;
        this.config = config;
        this.redisFactory = redisFactory;
        const ttlCandidate = Number(this.config.get('ROOM_PAYLOAD_CACHE_TTL_SECONDS') ?? 15);
        const ttl = Number.isFinite(ttlCandidate) && ttlCandidate >= 1 ? ttlCandidate : 15;
        this.roomPayloadTtlSeconds = Math.min(ttl, 3600);
    }
    async primeRoomPayloadCache(roomId, payload) {
        await this.persistRoomPayload(roomId, payload);
    }
    async invalidateRoomPayloadCache(roomId) {
        if (!this.redis) {
            this.ensureRedisInitialized();
        }
        if (!this.redis)
            return;
        try {
            await this.redis.del(this.roomPayloadKey(roomId));
        }
        catch {
        }
    }
    async updateRoomPayloadCache(roomId, updater) {
        if (!this.redis) {
            this.ensureRedisInitialized();
        }
        if (!this.redis)
            return null;
        try {
            const cached = await this.getCachedRoomPayload(roomId);
            if (!cached) {
                return null;
            }
            const next = updater(cached);
            if (!next) {
                return null;
            }
            await this.persistRoomPayload(roomId, next);
            return next;
        }
        catch {
            return null;
        }
    }
    async createRoom(userId, gameType, name, maxPlayers, isPrivate = false, invalidateCache = true) {
        const startedAt = Date.now();
        const owner = await this.requireUser(userId);
        const afterOwnerAt = Date.now();
        if (!gameType || gameType.trim() === '') {
            throw new common_1.BadRequestException('Type de jeu requis');
        }
        await this.leaveAllRoomsForUser(userId).catch(() => undefined);
        const gameId = gameType.trim();
        const known = await this.catalog.getGame(gameId);
        const afterCatalogAt = Date.now();
        if (!known) {
            throw new common_1.BadRequestException('Type de jeu invalide');
        }
        const status = String(known?.status ?? 'finished').toLowerCase();
        if (status === 'construction' && !RoomService_1.isAdminRoles(owner.roles)) {
            throw new common_1.ForbiddenException('Jeu en construction: réservé aux admins');
        }
        const resolvedMaxPlayers = maxPlayers && maxPlayers > 0
            ? maxPlayers
            : known.maxPlayers && known.maxPlayers > 0
                ? known.maxPlayers
                : 4;
        const room = await this.rooms.manager.transaction(async (manager) => {
            const roomRepo = manager.getRepository(room_entity_1.Room);
            const participantRepo = manager.getRepository(room_participant_entity_1.RoomParticipant);
            const room = roomRepo.create({
                name: name && name.trim() ? name.trim() : `Table ${gameType}`,
                gameType: gameId,
                maxPlayers: resolvedMaxPlayers,
                isPrivate: isPrivate === true,
                status: 'setup',
                owner,
                createdAt: new Date(),
            });
            await roomRepo.save(room);
            const participant = participantRepo.create({
                room,
                user: owner,
                role: 'owner',
            });
            await participantRepo.save(participant);
            return room;
        });
        if (invalidateCache) {
            await this.invalidateRoomPayloadCache(room.id);
        }
        this.notifyDirectoryChanged(room.id, 'created');
        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs >= 1500) {
            const now = Date.now();
            this.logger.warn(`createRoom lent ${JSON.stringify({
                userId,
                gameType: gameId,
                roomId: room.id,
                ms: elapsedMs,
                stepsMs: {
                    requireUser: afterOwnerAt - startedAt,
                    catalog: afterCatalogAt - afterOwnerAt,
                    transaction: now - afterCatalogAt,
                },
            })}`);
        }
        return room;
    }
    async joinRoom(roomId, userId, opts) {
        const room = await this.requireRoom(roomId);
        if (room.isPrivate && !opts?.allowPrivate) {
            throw new common_1.BadRequestException('Table privée');
        }
        const user = await this.requireUser(userId);
        const manifest = await this.catalog.getGame(room.gameType);
        const status = String(manifest?.status ?? 'finished').toLowerCase();
        if (status === 'construction' && !RoomService_1.isAdminRoles(user.roles)) {
            throw new common_1.ForbiddenException('Jeu en construction: réservé aux admins');
        }
        const existing = await this.participants.findOne({
            where: { room: { id: room.id }, user: { id: user.id }, leftAt: (0, typeorm_2.IsNull)() },
        });
        if (!this.isRoomOpen(room)) {
            if (existing) {
                await this.leaveAllRoomsForUser(userId, { exceptRoomId: room.id });
                await this.invalidateRoomPayloadCache(room.id);
                this.presenceService.broadcastPresence();
                this.notifyDirectoryChanged(room.id, 'joined');
                return room;
            }
            throw new common_1.BadRequestException('Table déjà démarrée');
        }
        const activeHumans = await this.countActiveHumans(room.id);
        const bots = await this.countBots(room.id);
        if (activeHumans + bots >= room.maxPlayers) {
            throw new common_1.BadRequestException('Table pleine');
        }
        await this.leaveAllRoomsForUser(userId, { exceptRoomId: room.id });
        if (!existing) {
            const participant = this.participants.create({
                room,
                user,
                role: 'player',
            });
            await this.participants.save(participant);
        }
        await this.invalidateRoomPayloadCache(room.id);
        if (String(room.status ?? '').toLowerCase() === 'started') {
            try {
                await this.stats.markQuit(room.id, user.id);
            }
            catch {
            }
        }
        this.presenceService.broadcastPresence();
        this.notifyDirectoryChanged(room.id, 'joined');
        return room;
    }
    async leaveRoom(roomId, userId, opts) {
        const room = await this.requireRoom(roomId);
        const user = await this.requireUser(userId);
        const participant = await this.participants.findOne({
            where: { room: { id: room.id }, user: { id: user.id }, leftAt: (0, typeorm_2.IsNull)() },
        });
        if (opts?.disconnectOnly) {
            this.presenceService.broadcastPresence();
            return room;
        }
        if (participant) {
            participant.leftAt = new Date();
            await this.participants.save(participant);
        }
        await this.invalidateRoomPayloadCache(room.id);
        if (participant &&
            opts?.disconnectOnly !== true &&
            room.restoredFromSnapshotId &&
            room.restoredOwnerUserId === userId) {
            const activeHumansAfterLeave = await this.countActiveHumans(room.id);
            if (activeHumansAfterLeave === 0) {
                const snapshotId = String(room.restoredFromSnapshotId ?? '').trim();
                this.logger.log('Restored room abandoned (no humans left => delete room)', {
                    roomId: room.id,
                    userId,
                    snapshotId: snapshotId || null,
                });
                if (snapshotId) {
                    try {
                        await this.vaultSnapshots.delete({
                            id: snapshotId,
                            ownerUserId: userId,
                        });
                    }
                    catch {
                    }
                }
                await this.adminDestroyRoom(room.id);
                return null;
            }
        }
        if (participant && String(room.status ?? '').toLowerCase() === 'started') {
            try {
                await this.stats.markQuit(room.id, user.id);
            }
            catch {
            }
        }
        if (participant &&
            room.owner &&
            room.owner.id === userId &&
            opts?.preserveOwner !== true) {
            const next = await this.participants.findOne({
                where: { room: { id: room.id }, leftAt: (0, typeorm_2.IsNull)() },
                relations: ['user'],
                order: { joinedAt: 'ASC' },
            });
            if (next?.user) {
                room.owner = next.user;
                await this.rooms.save(room);
                await this.invalidateRoomPayloadCache(room.id);
            }
        }
        const started = String(room.status ?? '').toLowerCase() === 'started' ||
            Boolean(room.startedAt);
        if (participant && started) {
            try {
                const activeHumans = await this.countActiveHumans(room.id);
                if (activeHumans > 0) {
                    await this.botService.addBotSystem(room.id);
                    await this.invalidateRoomPayloadCache(room.id);
                }
            }
            catch {
            }
        }
        if (opts?.preserveRoom) {
            this.presenceService.broadcastPresence();
            this.notifyDirectoryChanged(room.id, 'left');
            return room;
        }
        let activeHumans = await this.countActiveHumans(room.id);
        if (activeHumans === 0) {
            await this.botService.removeAllBotsForRoom(room.id);
        }
        activeHumans = await this.countActiveHumans(room.id);
        const bots = await this.countBots(room.id);
        const remaining = activeHumans + bots;
        if (remaining === 0) {
            this.logger.log('Room deleted (empty)', {
                roomId: room.id,
                userId,
                disconnectOnly: opts?.disconnectOnly === true,
                preserveRoom: opts?.preserveRoom === true,
                activeHumans,
                bots,
            });
            for (const notify of this.ensureRoomDeletedNotifiers()) {
                try {
                    await notify(room.id);
                }
                catch {
                }
            }
            await this.rooms.delete(room.id);
            this.roomBans.delete(room.id);
            await this.invalidateRoomPayloadCache(room.id);
            this.presenceService.broadcastPresence();
            this.notifyDirectoryChanged(room.id, 'deleted');
            return null;
        }
        this.presenceService.broadcastPresence();
        this.notifyDirectoryChanged(room.id, 'left');
        return room;
    }
    ensureRoomDeletedNotifiers() {
        const self = this;
        if (!Array.isArray(self._roomDeletedNotifiers)) {
            self._roomDeletedNotifiers = [];
        }
        return self._roomDeletedNotifiers;
    }
    async transferOwnerIfCurrent(roomId, userId) {
        const room = await this.rooms.findOne({
            where: { id: roomId },
            relations: ['owner'],
        });
        if (!room?.owner || room.owner.id !== userId)
            return;
        const next = await this.participants.findOne({
            where: { room: { id: room.id }, leftAt: (0, typeorm_2.IsNull)() },
            relations: ['user'],
            order: { joinedAt: 'ASC' },
        });
        if (!next?.user)
            return;
        room.owner = next.user;
        await this.rooms.save(room);
        await this.invalidateRoomPayloadCache(room.id);
        this.presenceService.broadcastPresence();
        this.notifyDirectoryChanged(room.id, 'left');
    }
    async togglePrivacy(roomId, userId, invalidateCache = true) {
        const room = await this.requireRoom(roomId);
        this.ensureOwner(room, userId);
        room.isPrivate = !room.isPrivate;
        await this.rooms.save(room);
        if (invalidateCache) {
            await this.invalidateRoomPayloadCache(room.id);
        }
        this.notifyDirectoryChanged(room.id, 'privacy');
        return room;
    }
    async startRoom(roomId, userId, invalidateCache = true) {
        const room = await this.requireRoom(roomId);
        this.ensureOwner(room, userId);
        const humans = await this.countActiveHumans(room.id);
        const bots = await this.countBots(room.id);
        if (humans + bots < 2) {
            throw new common_1.BadRequestException('Au moins deux participants sont requis');
        }
        room.status = 'started';
        if (!room.startedAt) {
            room.runId = Math.max(0, Number(room.runId ?? 0)) + 1;
            room.startedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
        }
        await this.rooms.save(room);
        if (invalidateCache) {
            await this.invalidateRoomPayloadCache(room.id);
        }
        this.notifyDirectoryChanged(room.id, 'started');
        try {
            const activeParticipants = await this.participants.find({
                where: { room: { id: room.id }, leftAt: (0, typeorm_2.IsNull)() },
                relations: ['user'],
            });
            void this.stats
                .startMatch({
                roomId: room.id,
                gameType: room.gameType,
                humans: activeParticipants.map((p) => ({
                    id: p.user.id,
                    username: p.user.username,
                })),
                botsCount: bots,
            })
                .catch(() => undefined);
        }
        catch {
        }
        return room;
    }
    async resetRoom(roomId, userId, invalidateCache = true) {
        const room = await this.requireRoom(roomId);
        const known = await this.catalog.getGame(room.gameType);
        if (!known) {
            throw new common_1.BadRequestException('Type de jeu invalide');
        }
        this.ensureOwner(room, userId);
        if (String(room.status ?? '').toLowerCase() === 'started') {
            try {
                void this.stats.endMatchOnReset(room.id).catch(() => undefined);
            }
            catch {
            }
        }
        room.status = 'setup';
        room.startedAt = null;
        await this.rooms.save(room);
        if (invalidateCache) {
            await this.invalidateRoomPayloadCache(room.id);
        }
        this.notifyDirectoryChanged(room.id, 'reset');
        return room;
    }
    async resetRoomSystem(roomId) {
        const existing = await this.rooms.findOne({ where: { id: roomId } });
        if (!existing) {
            throw new common_1.NotFoundException('Table introuvable');
        }
        await this.rooms.update({ id: existing.id }, { status: 'setup', startedAt: null });
        const room = await this.requireRoom(existing.id);
        await this.invalidateRoomPayloadCache(room.id);
        this.notifyDirectoryChanged(room.id, 'reset');
        return room;
    }
    async getRoomPayload(roomId) {
        const cached = await this.getCachedRoomPayload(roomId);
        if (cached) {
            return cached;
        }
        const room = await this.rooms.findOne({
            where: { id: roomId },
            relations: ['owner', 'participants', 'participants.user', 'bots'],
        });
        if (!room) {
            throw new common_1.NotFoundException('Room introuvable');
        }
        const payload = await this.toPayload(room);
        await this.persistRoomPayload(roomId, payload);
        return payload;
    }
    async toPayload(room) {
        const manifest = await this.catalog.getGame(room.gameType);
        return {
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
                runId: typeof room.runId === 'number' ? room.runId : null,
                tableAmbienceSoundId: typeof room.tableAmbienceSoundId === 'string'
                    ? String(room.tableAmbienceSoundId).trim() || null
                    : null,
                counts: {
                    players: (room.participants || []).filter((p) => !p.leftAt).length,
                    spectators: 0,
                },
                owner: room.owner
                    ? { id: room.owner.id, username: room.owner.username }
                    : null,
                players: (room.participants || [])
                    .filter((p) => !p.leftAt)
                    .map((p) => ({ id: p.user.id, username: p.user.username })),
                spectators: [],
                bots: (room.bots || []).map((b) => ({ id: b.id, name: b.name })),
            },
            generatedAt: new Date().toISOString(),
        };
    }
    async requireRoom(roomId) {
        const room = await this.rooms.findOne({
            where: { id: roomId },
            relations: ['owner'],
        });
        if (!room) {
            throw new common_1.NotFoundException('Table introuvable');
        }
        return room;
    }
    async requireUser(userId) {
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur introuvable');
        }
        return user;
    }
    ensureOwner(room, userId) {
        if (!room.owner || room.owner.id !== userId) {
            throw new common_1.ForbiddenException('Seul le propriétaire peut effectuer cette action');
        }
    }
    isRoomOpen(room) {
        if (room.startedAt) {
            return false;
        }
        const status = (room.status || '').toLowerCase();
        return room_status_constants_1.OPEN_ROOM_STATUSES.includes(status);
    }
    async countActiveHumans(roomId) {
        return this.participants.count({
            where: { room: { id: roomId }, leftAt: (0, typeorm_2.IsNull)() },
        });
    }
    async countBots(roomId) {
        return this.botService.countBotsForRoom(roomId);
    }
    async leaveAllRoomsForUser(userId, opts) {
        const except = typeof opts?.exceptRoomId === 'number' &&
            Number.isFinite(opts.exceptRoomId) &&
            opts.exceptRoomId > 0
            ? Math.floor(opts.exceptRoomId)
            : 0;
        const activeParticipations = await this.participants.find({
            where: { user: { id: userId }, leftAt: (0, typeorm_2.IsNull)() },
            relations: ['room'],
        });
        for (const participation of activeParticipations) {
            const roomId = participation?.room?.id ?? 0;
            if (!Number.isFinite(roomId) || roomId <= 0) {
                continue;
            }
            if (except > 0 && roomId === except) {
                continue;
            }
            try {
                await this.leaveRoom(roomId, userId, {
                    preserveRoom: false,
                    disconnectOnly: false,
                });
            }
            catch {
            }
        }
    }
    async findLatestActiveRoomForUser(userId) {
        if (!Number.isFinite(userId) || userId <= 0)
            return null;
        const startedParticipation = await this.participants
            .createQueryBuilder('p')
            .innerJoinAndSelect('p.room', 'r')
            .where('p.user_id = :userId', { userId })
            .andWhere('p.left_at IS NULL')
            .andWhere('(r.started_at IS NOT NULL OR LOWER(r.status) = :started)', {
            started: 'started',
        })
            .orderBy('p.joined_at', 'DESC')
            .getOne();
        const p = startedParticipation ??
            (await this.participants.findOne({
                where: { user: { id: userId }, leftAt: (0, typeorm_2.IsNull)() },
                relations: ['room'],
                order: { joinedAt: 'DESC' },
            }));
        const roomId = p?.room?.id ?? 0;
        const gameType = String(p?.room?.gameType ?? '').trim();
        if (!Number.isFinite(roomId) || roomId <= 0)
            return null;
        if (!gameType)
            return null;
        return { roomId, gameType };
    }
    roomPayloadKey(roomId) {
        return `${this.roomPayloadRedisPrefix}${roomId}`;
    }
    ensureRedisInitialized() {
        if (this.redis)
            return;
        const redisUrl = this.config.get('ROOM_PAYLOAD_REDIS_URL') ??
            this.config.get('SESSION_STORE_REDIS_URL') ??
            null;
        if (!redisUrl)
            return;
        try {
            this.redis = this.redisFactory.create(redisUrl, 'room-payload-cache');
        }
        catch {
            this.redis = null;
        }
    }
    async getCachedRoomPayload(roomId) {
        if (!this.redis) {
            this.ensureRedisInitialized();
        }
        if (!this.redis)
            return null;
        try {
            const raw = await this.redis.get(this.roomPayloadKey(roomId));
            if (!raw)
                return null;
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async persistRoomPayload(roomId, payload) {
        if (!this.redis) {
            this.ensureRedisInitialized();
        }
        if (!this.redis)
            return;
        try {
            await this.redis.set(this.roomPayloadKey(roomId), JSON.stringify(payload), 'EX', this.roomPayloadTtlSeconds);
        }
        catch {
        }
    }
};
exports.RoomService = RoomService;
exports.RoomService = RoomService = RoomService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(room_entity_1.Room)),
    __param(1, (0, typeorm_1.InjectRepository)(room_participant_entity_1.RoomParticipant)),
    __param(2, (0, typeorm_1.InjectRepository)(vault_room_snapshot_entity_1.VaultRoomSnapshotEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(4, (0, common_2.Inject)((0, common_2.forwardRef)(() => bot_service_1.BotService))),
    __param(5, (0, common_2.Inject)((0, common_2.forwardRef)(() => presence_service_1.PresenceService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        bot_service_1.BotService,
        presence_service_1.PresenceService,
        catalog_service_1.CatalogService,
        game_stats_service_1.GameStatsService,
        room_realtime_tracker_service_1.RoomRealtimeTrackerService,
        config_1.ConfigService,
        redis_client_factory_1.RedisClientFactory])
], RoomService);
//# sourceMappingURL=room.service.js.map