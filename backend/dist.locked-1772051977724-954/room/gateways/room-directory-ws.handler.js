"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomDirectoryWsHandler", {
    enumerable: true,
    get: function() {
        return RoomDirectoryWsHandler;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _notificationservice = require("../../notification/services/notification.service");
const _roomentity = require("../entities/room.entity");
const _roomparticipantentity = require("../entities/room-participant.entity");
const _roomspublicdto = require("../dto/rooms-public.dto");
const _roominvitedto = require("../dto/room-invite.dto");
const _roomservice = require("../services/room.service");
const _roominviteservice = require("../services/room-invite.service");
const _roomstatusconstants = require("../constants/room-status.constants");
const _roomdirectoryutils = require("../utils/room-directory.utils");
const _catalogservice = require("../../catalog/services/catalog.service");
const _publicroomdirectoryservice = require("../services/public-room-directory.service");
const _roomrealtimetrackerservice = require("../services/room-realtime-tracker.service");
const _presenceservice = require("../../presence/services/presence.service");
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
let RoomDirectoryWsHandler = class RoomDirectoryWsHandler {
    async listPublic(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_roomspublicdto.RoomsPublicListDto, payload);
        const isAdmin = Array.isArray(user.roles) ? user.roles.includes('ROLE_ADMIN') || user.roles.includes('admin') : false;
        const allowedGames = (await this.catalog.getAllGames()).filter((g)=>{
            const status = String(g?.status ?? 'finished').toLowerCase();
            if (status === 'construction') {
                return isAdmin;
            }
            return true;
        });
        const allowed = new Set(allowedGames.map((g)=>g.id));
        if (dto.gameType && !allowed.has(dto.gameType)) {
            return {
                type: 'rooms.public.listed',
                payload: {
                    items: [],
                    groups: []
                }
            };
        }
        const statuses = _roomstatusconstants.OPEN_ROOM_STATUSES.map((s)=>s.toLowerCase());
        const qb = this.roomRepo.createQueryBuilder('room').leftJoinAndSelect('room.owner', 'owner').leftJoinAndSelect('room.participants', 'participant', 'participant.leftAt IS NULL').leftJoinAndSelect('participant.user', 'participantUser').leftJoinAndSelect('room.bots', 'bot').where('room.isPrivate = :isPrivate', {
            isPrivate: false
        }).andWhere('(room.startedAt IS NOT NULL OR LOWER(room.status) IN (:...statuses))', {
            statuses
        });
        if (dto.gameType) {
            qb.andWhere('room.gameType = :gameType', {
                gameType: dto.gameType
            });
        }
        const rooms = await qb.getMany();
        // Option recommandée: n'afficher que les tables où au moins 1 joueur (participant) est réellement connecté.
        const activeRoomIds = new Set(this.realtimeTracker.getActivePlayerRoomIds());
        const activeRooms = rooms.filter((r)=>activeRoomIds.has(r.id));
        const built = (0, _roomdirectoryutils.buildPublicRoomList)(activeRooms, {
            allowedGameTypes: allowed
        });
        const isBanned = (roomId)=>this.rooms.isBanned(roomId, user.id);
        built.items = built.items.map((it)=>({
                ...it,
                banned: isBanned(it.id)
            }));
        built.groups = built.groups.map((g)=>({
                ...g,
                rooms: g.rooms.map((it)=>({
                        ...it,
                        banned: isBanned(it.id)
                    }))
            }));
        return {
            type: 'rooms.public.listed',
            payload: built
        };
    }
    async joinPublic(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_roomspublicdto.RoomsPublicJoinDto, payload);
        if (this.rooms.isBanned(dto.roomId, user.id)) {
            throw new _common.ForbiddenException('Banni de cette table');
        }
        await this.rooms.joinRoom(dto.roomId, user.id);
        const state = await this.rooms.getRoomPayload(dto.roomId);
        return {
            type: 'rooms.public.joined',
            payload: {
                roomId: dto.roomId,
                room: state.room
            }
        };
    }
    async leavePublic(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_roomspublicdto.RoomsPublicJoinDto, payload);
        const room = await this.rooms.leaveRoom(dto.roomId, user.id);
        if (!room) {
            return {
                type: 'rooms.public.left',
                payload: {
                    roomId: dto.roomId,
                    deleted: true
                }
            };
        }
        const state = await this.rooms.getRoomPayload(dto.roomId);
        return {
            type: 'rooms.public.left',
            payload: {
                roomId: dto.roomId,
                room: state.room
            }
        };
    }
    async spectatePublic(session, payload) {
        (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_roomspublicdto.RoomsPublicJoinDto, payload);
        const state = await this.rooms.getRoomPayload(dto.roomId);
        if (state.room.isPrivate) {
            throw new _common.ForbiddenException('Spectateurs interdits sur les tables privées');
        }
        return {
            type: 'rooms.public.spectated',
            payload: {
                roomId: dto.roomId,
                room: state.room
            }
        };
    }
    async subscribePublic(session, payload) {
        (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_roomspublicdto.RoomsPublicListDto, payload);
        this.directory.subscribe(session.connectionId, dto.gameType ?? null);
        const listed = await this.listPublic(session, payload);
        return {
            type: 'rooms.public.subscribed',
            payload: listed.payload
        };
    }
    async unsubscribePublic(session) {
        (0, _wsauth.requireUser)(session);
        this.directory.unsubscribe(session.connectionId);
        return {
            type: 'rooms.public.unsubscribed',
            payload: {
                ok: true
            }
        };
    }
    async inviteSend(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_roominvitedto.RoomInviteSendDto, payload);
        const room = await this.roomRepo.findOne({
            where: {
                id: dto.roomId
            },
            relations: [
                'owner'
            ]
        });
        if (!room) {
            throw new _common.NotFoundException('Table introuvable');
        }
        if (!room.owner || room.owner.id !== user.id) {
            throw new _common.ForbiddenException('Seul le propriétaire peut inviter');
        }
        const existingParticipant = await this.participantRepo.findOne({
            where: {
                room: {
                    id: room.id
                },
                user: {
                    id: dto.userId
                },
                leftAt: (0, _typeorm1.IsNull)()
            }
        });
        if (existingParticipant) {
            return {
                type: 'rooms.invite.sent',
                payload: {
                    roomId: room.id,
                    userId: dto.userId,
                    alreadyInRoom: true
                }
            };
        }
        const existingInvite = this.invites.findActive(room.id, dto.userId);
        if (existingInvite) {
            // Une invitation est déjà en attente pour ce joueur : éviter les doublons (notification + spam).
            return {
                type: 'rooms.invite.sent',
                payload: {
                    invitationId: existingInvite.id,
                    roomId: room.id,
                    userId: dto.userId,
                    pending: true,
                    expiresAt: existingInvite.expiresAt
                }
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
                maxPlayers: room.maxPlayers
            },
            from: {
                id: user.id,
                username: user.username
            },
            expiresAt: invite.expiresAt
        });
        return {
            type: 'rooms.invite.sent',
            payload: {
                invitationId: invite.id,
                roomId: room.id,
                userId: dto.userId
            }
        };
    }
    async invitePresenceList(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_roominvitedto.RoomInvitePresenceListDto, payload ?? {});
        const room = await this.roomRepo.findOne({
            where: {
                id: dto.roomId
            },
            relations: [
                'owner'
            ]
        });
        if (!room) {
            throw new _common.NotFoundException('Table introuvable');
        }
        if (!room.owner || room.owner.id !== user.id) {
            throw new _common.ForbiddenException('Seul le propriétaire peut inviter');
        }
        const activeParticipantIds = new Set((await this.participantRepo.createQueryBuilder('p').select('p.user_id', 'userId').where('p.room_id = :roomId', {
            roomId: room.id
        }).andWhere('p.left_at IS NULL').getRawMany()).map((r)=>Number(r?.userId ?? 0)).filter((id)=>Number.isFinite(id) && id > 0));
        const players = this.presence.listPlayers().filter((p)=>p.id !== user.id).filter((p)=>p.availability !== 'absent').filter((p)=>!activeParticipantIds.has(p.id)).map((p)=>({
                id: p.id,
                username: p.username,
                availability: p.availability ?? null,
                location: p.location ?? null,
                currentRoom: p.currentRoom ?? null,
                pendingInvite: Boolean(this.invites.findActive(room.id, p.id))
            })).sort((a, b)=>a.username.localeCompare(b.username, undefined, {
                sensitivity: 'base'
            }));
        return {
            type: 'rooms.invite.presence.listed',
            payload: {
                roomId: dto.roomId,
                players
            }
        };
    }
    async inviteRespond(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_roominvitedto.RoomInviteRespondDto, payload);
        const invite = this.invites.get(dto.invitationId);
        if (!invite) {
            return {
                type: 'rooms.invite.responded',
                payload: {
                    invitationId: dto.invitationId,
                    accepted: false,
                    expired: true
                }
            };
        }
        if (invite.toUserId !== user.id) {
            throw new _common.ForbiddenException('Invitation non destinée à cet utilisateur');
        }
        if (!dto.accept) {
            this.invites.delete(dto.invitationId);
            void this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
                invitationId: dto.invitationId,
                roomId: invite.roomId,
                accepted: false,
                by: {
                    id: user.id,
                    username: user.username
                }
            });
            return {
                type: 'rooms.invite.responded',
                payload: {
                    invitationId: dto.invitationId,
                    accepted: false
                }
            };
        }
        const current = await this.rooms.getRoomPayload(invite.roomId);
        const started = (current.room.status || '').toLowerCase() === 'started' || Boolean(current.room.startedAt);
        if (started) {
            // Table déjà démarrée : l'invité rejoint en spectateur (même table privée).
            this.invites.consume(dto.invitationId, {
                keep: true
            });
            // Best-effort: rafraîchir la room côté propriétaire (ex: afficher un badge "spectateur accepté").
            try {
                await this.rooms.notifyRoomStateUpdated(invite.roomId);
            } catch  {
            // ignore
            }
            void this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
                invitationId: dto.invitationId,
                roomId: invite.roomId,
                accepted: true,
                by: {
                    id: user.id,
                    username: user.username
                }
            });
            return {
                type: 'rooms.invite.accepted',
                payload: {
                    roomId: invite.roomId,
                    room: current.room,
                    spectator: true
                }
            };
        }
        // accept: join first, then consume the invitation (one-shot) only on success
        try {
            await this.rooms.joinRoom(invite.roomId, user.id, {
                allowPrivate: true
            });
            this.invites.consume(dto.invitationId);
            // Important: prévenir les clients déjà connectés à la table (propriétaire) pour que le roster se mette à jour.
            try {
                await this.rooms.notifyRoomStateUpdated(invite.roomId);
            } catch  {
            // ignore
            }
        } catch (err) {
            const msg = String(err?.message ?? '');
            const msgLower = msg.toLowerCase();
            if (msgLower.includes('démarr') || msgLower.includes('demarr')) {
                const state = await this.rooms.getRoomPayload(invite.roomId);
                this.invites.consume(dto.invitationId, {
                    keep: true
                });
                try {
                    await this.rooms.notifyRoomStateUpdated(invite.roomId);
                } catch  {
                // ignore
                }
                void this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
                    invitationId: dto.invitationId,
                    roomId: invite.roomId,
                    accepted: true,
                    by: {
                        id: user.id,
                        username: user.username
                    }
                });
                return {
                    type: 'rooms.invite.accepted',
                    payload: {
                        roomId: invite.roomId,
                        room: state.room,
                        spectator: true
                    }
                };
            }
            throw err;
        }
        const state = await this.rooms.getRoomPayload(invite.roomId);
        void this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
            invitationId: dto.invitationId,
            roomId: invite.roomId,
            accepted: true,
            by: {
                id: user.id,
                username: user.username
            }
        });
        return {
            type: 'rooms.invite.accepted',
            payload: {
                roomId: invite.roomId,
                room: state.room,
                spectator: false
            }
        };
    }
    constructor(validator, rooms, invites, notifications, catalog, directory, realtimeTracker, presence, roomRepo, participantRepo){
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
};
RoomDirectoryWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(8, (0, _typeorm.InjectRepository)(_roomentity.Room)),
    _ts_param(9, (0, _typeorm.InjectRepository)(_roomparticipantentity.RoomParticipant)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _roomservice.RoomService === "undefined" ? Object : _roomservice.RoomService,
        typeof _roominviteservice.RoomInviteService === "undefined" ? Object : _roominviteservice.RoomInviteService,
        typeof _notificationservice.NotificationService === "undefined" ? Object : _notificationservice.NotificationService,
        typeof _catalogservice.CatalogService === "undefined" ? Object : _catalogservice.CatalogService,
        typeof _publicroomdirectoryservice.PublicRoomDirectoryService === "undefined" ? Object : _publicroomdirectoryservice.PublicRoomDirectoryService,
        typeof _roomrealtimetrackerservice.RoomRealtimeTrackerService === "undefined" ? Object : _roomrealtimetrackerservice.RoomRealtimeTrackerService,
        typeof _presenceservice.PresenceService === "undefined" ? Object : _presenceservice.PresenceService,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], RoomDirectoryWsHandler);
