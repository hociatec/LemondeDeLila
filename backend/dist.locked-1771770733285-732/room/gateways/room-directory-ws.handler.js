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
exports.RoomDirectoryWsHandler = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const notification_service_1 = require("../../notification/services/notification.service");
const room_entity_1 = require("../entities/room.entity");
const room_participant_entity_1 = require("../entities/room-participant.entity");
const rooms_public_dto_1 = require("../dto/rooms-public.dto");
const room_invite_dto_1 = require("../dto/room-invite.dto");
const room_service_1 = require("../services/room.service");
const room_invite_service_1 = require("../services/room-invite.service");
const room_status_constants_1 = require("../constants/room-status.constants");
const room_directory_utils_1 = require("../utils/room-directory.utils");
const catalog_service_1 = require("../../catalog/services/catalog.service");
const public_room_directory_service_1 = require("../services/public-room-directory.service");
const room_realtime_tracker_service_1 = require("../services/room-realtime-tracker.service");
const presence_service_1 = require("../../presence/services/presence.service");
let RoomDirectoryWsHandler = class RoomDirectoryWsHandler {
    validator;
    rooms;
    invites;
    notifications;
    catalog;
    directory;
    realtimeTracker;
    presence;
    roomRepo;
    participantRepo;
    constructor(validator, rooms, invites, notifications, catalog, directory, realtimeTracker, presence, roomRepo, participantRepo) {
        this.validator = validator;
        this.rooms = rooms;
        this.invites = invites;
        this.notifications = notifications;
        this.catalog = catalog;
        this.directory = directory;
        this.realtimeTracker = realtimeTracker;
        this.presence = presence;
        this.roomRepo = roomRepo;
        this.participantRepo = participantRepo;
    }
    async listPublic(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(rooms_public_dto_1.RoomsPublicListDto, payload);
        const isAdmin = Array.isArray(user.roles)
            ? user.roles.includes('ROLE_ADMIN') || user.roles.includes('admin')
            : false;
        const allowedGames = (await this.catalog.getAllGames()).filter((g) => {
            const status = String(g?.status ?? 'finished').toLowerCase();
            if (status === 'construction') {
                return isAdmin;
            }
            return true;
        });
        const allowed = new Set(allowedGames.map((g) => g.id));
        if (dto.gameType && !allowed.has(dto.gameType)) {
            return {
                type: 'rooms.public.listed',
                payload: { items: [], groups: [] },
            };
        }
        const statuses = room_status_constants_1.OPEN_ROOM_STATUSES.map((s) => s.toLowerCase());
        const qb = this.roomRepo
            .createQueryBuilder('room')
            .leftJoinAndSelect('room.owner', 'owner')
            .leftJoinAndSelect('room.participants', 'participant', 'participant.leftAt IS NULL')
            .leftJoinAndSelect('participant.user', 'participantUser')
            .leftJoinAndSelect('room.bots', 'bot')
            .where('room.isPrivate = :isPrivate', { isPrivate: false })
            .andWhere('(room.startedAt IS NOT NULL OR LOWER(room.status) IN (:...statuses))', { statuses });
        if (dto.gameType) {
            qb.andWhere('room.gameType = :gameType', { gameType: dto.gameType });
        }
        const rooms = await qb.getMany();
        const activeRoomIds = new Set(this.realtimeTracker.getActivePlayerRoomIds());
        const activeRooms = rooms.filter((r) => activeRoomIds.has(r.id));
        const built = (0, room_directory_utils_1.buildPublicRoomList)(activeRooms, {
            allowedGameTypes: allowed,
        });
        const isBanned = (roomId) => this.rooms.isBanned(roomId, user.id);
        built.items = built.items.map((it) => ({ ...it, banned: isBanned(it.id) }));
        built.groups = built.groups.map((g) => ({
            ...g,
            rooms: g.rooms.map((it) => ({ ...it, banned: isBanned(it.id) })),
        }));
        return { type: 'rooms.public.listed', payload: built };
    }
    async joinPublic(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(rooms_public_dto_1.RoomsPublicJoinDto, payload);
        if (this.rooms.isBanned(dto.roomId, user.id)) {
            throw new common_1.ForbiddenException('Banni de cette table');
        }
        await this.rooms.joinRoom(dto.roomId, user.id);
        const state = await this.rooms.getRoomPayload(dto.roomId);
        return {
            type: 'rooms.public.joined',
            payload: { roomId: dto.roomId, room: state.room },
        };
    }
    async leavePublic(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(rooms_public_dto_1.RoomsPublicJoinDto, payload);
        const room = await this.rooms.leaveRoom(dto.roomId, user.id);
        if (!room) {
            return {
                type: 'rooms.public.left',
                payload: { roomId: dto.roomId, deleted: true },
            };
        }
        const state = await this.rooms.getRoomPayload(dto.roomId);
        return {
            type: 'rooms.public.left',
            payload: { roomId: dto.roomId, room: state.room },
        };
    }
    async spectatePublic(session, payload) {
        (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(rooms_public_dto_1.RoomsPublicJoinDto, payload);
        const state = await this.rooms.getRoomPayload(dto.roomId);
        if (state.room.isPrivate) {
            throw new common_1.ForbiddenException('Spectateurs interdits sur les tables privées');
        }
        return {
            type: 'rooms.public.spectated',
            payload: { roomId: dto.roomId, room: state.room },
        };
    }
    async subscribePublic(session, payload) {
        (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(rooms_public_dto_1.RoomsPublicListDto, payload);
        this.directory.subscribe(session.connectionId, dto.gameType ?? null);
        const listed = await this.listPublic(session, payload);
        return { type: 'rooms.public.subscribed', payload: listed.payload };
    }
    async unsubscribePublic(session) {
        (0, ws_auth_1.requireUser)(session);
        this.directory.unsubscribe(session.connectionId);
        return { type: 'rooms.public.unsubscribed', payload: { ok: true } };
    }
    async inviteSend(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(room_invite_dto_1.RoomInviteSendDto, payload);
        const room = await this.roomRepo.findOne({
            where: { id: dto.roomId },
            relations: ['owner'],
        });
        if (!room) {
            throw new common_1.NotFoundException('Table introuvable');
        }
        if (!room.owner || room.owner.id !== user.id) {
            throw new common_1.ForbiddenException('Seul le propriétaire peut inviter');
        }
        const existingParticipant = await this.participantRepo.findOne({
            where: {
                room: { id: room.id },
                user: { id: dto.userId },
                leftAt: (0, typeorm_2.IsNull)(),
            },
        });
        if (existingParticipant) {
            return {
                type: 'rooms.invite.sent',
                payload: { roomId: room.id, userId: dto.userId, alreadyInRoom: true },
            };
        }
        const existingInvite = this.invites.findActive(room.id, dto.userId);
        if (existingInvite) {
            return {
                type: 'rooms.invite.sent',
                payload: {
                    invitationId: existingInvite.id,
                    roomId: room.id,
                    userId: dto.userId,
                    pending: true,
                    expiresAt: existingInvite.expiresAt,
                },
            };
        }
        const invite = this.invites.create(room.id, user.id, dto.userId);
        void this.notifications.notifyUser(dto.userId, 'rooms.invite.received', {
            invitationId: invite.id,
            room: {
                id: room.id,
                name: room.name,
                gameType: room.gameType,
                status: room.status,
                maxPlayers: room.maxPlayers,
            },
            from: { id: user.id, username: user.username },
            expiresAt: invite.expiresAt,
        });
        return {
            type: 'rooms.invite.sent',
            payload: { invitationId: invite.id, roomId: room.id, userId: dto.userId },
        };
    }
    async invitePresenceList(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(room_invite_dto_1.RoomInvitePresenceListDto, payload ?? {});
        const room = await this.roomRepo.findOne({
            where: { id: dto.roomId },
            relations: ['owner'],
        });
        if (!room) {
            throw new common_1.NotFoundException('Table introuvable');
        }
        if (!room.owner || room.owner.id !== user.id) {
            throw new common_1.ForbiddenException('Seul le propriétaire peut inviter');
        }
        const activeParticipantIds = new Set((await this.participantRepo
            .createQueryBuilder('p')
            .select('p.user_id', 'userId')
            .where('p.room_id = :roomId', { roomId: room.id })
            .andWhere('p.left_at IS NULL')
            .getRawMany())
            .map((r) => Number(r?.userId ?? 0))
            .filter((id) => Number.isFinite(id) && id > 0));
        const players = this.presence
            .listPlayers()
            .filter((p) => p.id !== user.id)
            .filter((p) => p.availability !== 'absent')
            .filter((p) => !activeParticipantIds.has(p.id))
            .map((p) => ({
            id: p.id,
            username: p.username,
            availability: p.availability ?? null,
            location: p.location ?? null,
            currentRoom: p.currentRoom ?? null,
            pendingInvite: Boolean(this.invites.findActive(room.id, p.id)),
        }))
            .sort((a, b) => a.username.localeCompare(b.username, undefined, {
            sensitivity: 'base',
        }));
        return {
            type: 'rooms.invite.presence.listed',
            payload: { roomId: dto.roomId, players },
        };
    }
    async inviteRespond(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(room_invite_dto_1.RoomInviteRespondDto, payload);
        const invite = this.invites.get(dto.invitationId);
        if (!invite) {
            return {
                type: 'rooms.invite.responded',
                payload: {
                    invitationId: dto.invitationId,
                    accepted: false,
                    expired: true,
                },
            };
        }
        if (invite.toUserId !== user.id) {
            throw new common_1.ForbiddenException('Invitation non destinée à cet utilisateur');
        }
        if (!dto.accept) {
            this.invites.delete(dto.invitationId);
            void this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
                invitationId: dto.invitationId,
                roomId: invite.roomId,
                accepted: false,
                by: { id: user.id, username: user.username },
            });
            return {
                type: 'rooms.invite.responded',
                payload: { invitationId: dto.invitationId, accepted: false },
            };
        }
        const current = await this.rooms.getRoomPayload(invite.roomId);
        const started = (current.room.status || '').toLowerCase() === 'started' ||
            Boolean(current.room.startedAt);
        if (started) {
            this.invites.consume(dto.invitationId, { keep: true });
            try {
                await this.rooms.notifyRoomStateUpdated(invite.roomId);
            }
            catch {
            }
            void this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
                invitationId: dto.invitationId,
                roomId: invite.roomId,
                accepted: true,
                by: { id: user.id, username: user.username },
            });
            return {
                type: 'rooms.invite.accepted',
                payload: { roomId: invite.roomId, room: current.room, spectator: true },
            };
        }
        try {
            await this.rooms.joinRoom(invite.roomId, user.id, { allowPrivate: true });
            this.invites.consume(dto.invitationId);
            try {
                await this.rooms.notifyRoomStateUpdated(invite.roomId);
            }
            catch {
            }
        }
        catch (err) {
            const msg = String(err?.message ?? '');
            const msgLower = msg.toLowerCase();
            if (msgLower.includes('démarr') || msgLower.includes('demarr')) {
                const state = await this.rooms.getRoomPayload(invite.roomId);
                this.invites.consume(dto.invitationId, { keep: true });
                try {
                    await this.rooms.notifyRoomStateUpdated(invite.roomId);
                }
                catch {
                }
                void this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
                    invitationId: dto.invitationId,
                    roomId: invite.roomId,
                    accepted: true,
                    by: { id: user.id, username: user.username },
                });
                return {
                    type: 'rooms.invite.accepted',
                    payload: { roomId: invite.roomId, room: state.room, spectator: true },
                };
            }
            throw err;
        }
        const state = await this.rooms.getRoomPayload(invite.roomId);
        void this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
            invitationId: dto.invitationId,
            roomId: invite.roomId,
            accepted: true,
            by: { id: user.id, username: user.username },
        });
        return {
            type: 'rooms.invite.accepted',
            payload: { roomId: invite.roomId, room: state.room, spectator: false },
        };
    }
};
exports.RoomDirectoryWsHandler = RoomDirectoryWsHandler;
exports.RoomDirectoryWsHandler = RoomDirectoryWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __param(8, (0, typeorm_1.InjectRepository)(room_entity_1.Room)),
    __param(9, (0, typeorm_1.InjectRepository)(room_participant_entity_1.RoomParticipant)),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        room_service_1.RoomService,
        room_invite_service_1.RoomInviteService,
        notification_service_1.NotificationService,
        catalog_service_1.CatalogService,
        public_room_directory_service_1.PublicRoomDirectoryService,
        room_realtime_tracker_service_1.RoomRealtimeTrackerService,
        presence_service_1.PresenceService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], RoomDirectoryWsHandler);
//# sourceMappingURL=room-directory-ws.handler.js.map