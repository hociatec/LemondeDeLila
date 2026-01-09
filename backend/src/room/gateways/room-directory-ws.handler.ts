import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { requireUser } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { NotificationService } from '../../notification/services/notification.service';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import {
  RoomsPublicJoinDto,
  RoomsPublicListDto,
} from '../dto/rooms-public.dto';
import {
  RoomInviteRespondDto,
  RoomInviteSendDto,
  RoomInvitePresenceListDto,
} from '../dto/room-invite.dto';
import { RoomService } from '../services/room.service';
import { RoomInviteService } from '../services/room-invite.service';
import { OPEN_ROOM_STATUSES } from '../constants/room-status.constants';
import { buildPublicRoomList } from '../utils/room-directory.utils';
import { CatalogService } from '../../catalog/services/catalog.service';
import { PublicRoomDirectoryService } from '../services/public-room-directory.service';
import { RoomRealtimeTrackerService } from '../services/room-realtime-tracker.service';
import { PresenceService } from '../../presence/services/presence.service';

@Injectable()
export class RoomDirectoryWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly rooms: RoomService,
    private readonly invites: RoomInviteService,
    private readonly notifications: NotificationService,
    private readonly catalog: CatalogService,
    private readonly directory: PublicRoomDirectoryService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly presence: PresenceService,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participantRepo: Repository<RoomParticipant>,
  ) {}

  async listPublic(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicListDto, payload);
    const allowed = new Set(
      (await this.catalog.getAllGames()).map((g) => g.id),
    );
    if (dto.gameType && !allowed.has(dto.gameType)) {
      return {
        type: 'rooms.public.listed',
        payload: { items: [], groups: [] },
      };
    }
    const statuses = OPEN_ROOM_STATUSES.map((s) => s.toLowerCase());
    const qb = this.roomRepo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.owner', 'owner')
      .leftJoinAndSelect(
        'room.participants',
        'participant',
        'participant.leftAt IS NULL',
      )
      .leftJoinAndSelect('participant.user', 'participantUser')
      .leftJoinAndSelect('room.bots', 'bot')
      .where('room.isPrivate = :isPrivate', { isPrivate: false })
      .andWhere(
        '(room.startedAt IS NOT NULL OR LOWER(room.status) IN (:...statuses))',
        { statuses },
      );
    if (dto.gameType) {
      qb.andWhere('room.gameType = :gameType', { gameType: dto.gameType });
    }
    const rooms = await qb.getMany();
    // Option recommandée: n'afficher que les tables où au moins 1 joueur (participant) est réellement connecté.
    const activeRoomIds = new Set(
      this.realtimeTracker.getActivePlayerRoomIds(),
    );
    const activeRooms = rooms.filter((r) => activeRoomIds.has(r.id));
    const built = buildPublicRoomList(activeRooms, {
      allowedGameTypes: allowed,
    });
    const isBanned = (roomId: number) => this.rooms.isBanned(roomId, user.id);
    built.items = built.items.map((it) => ({ ...it, banned: isBanned(it.id) }));
    built.groups = built.groups.map((g) => ({
      ...g,
      rooms: g.rooms.map((it) => ({ ...it, banned: isBanned(it.id) })),
    }));
    return { type: 'rooms.public.listed', payload: built };
  }

  async joinPublic(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    if (this.rooms.isBanned(dto.roomId, user.id)) {
      throw new ForbiddenException('Banni de cette table');
    }
    await this.rooms.joinRoom(dto.roomId, user.id);
    const state = await this.rooms.getRoomPayload(dto.roomId);
    return {
      type: 'rooms.public.joined',
      payload: { roomId: dto.roomId, room: state.room },
    };
  }

  async leavePublic(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
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

  async spectatePublic(session: WsSession, payload: any) {
    requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    const state = await this.rooms.getRoomPayload(dto.roomId);
    if (state.room.isPrivate) {
      throw new ForbiddenException(
        'Spectateurs interdits sur les tables privées',
      );
    }
    return {
      type: 'rooms.public.spectated',
      payload: { roomId: dto.roomId, room: state.room },
    };
  }

  async subscribePublic(session: WsSession, payload: any) {
    requireUser(session);
    const dto = this.validator.validate(RoomsPublicListDto, payload);
    this.directory.subscribe(session.connectionId, dto.gameType ?? null);
    const listed = await this.listPublic(session, payload);
    return { type: 'rooms.public.subscribed', payload: listed.payload };
  }

  async unsubscribePublic(session: WsSession) {
    requireUser(session);
    this.directory.unsubscribe(session.connectionId);
    return { type: 'rooms.public.unsubscribed', payload: { ok: true } };
  }

  async inviteSend(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomInviteSendDto, payload);
    const room = await this.roomRepo.findOne({
      where: { id: dto.roomId },
      relations: ['owner'],
    });
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    if (!room.owner || room.owner.id !== user.id) {
      throw new ForbiddenException('Seul le propriétaire peut inviter');
    }
    const existingParticipant = await this.participantRepo.findOne({
      where: {
        room: { id: room.id },
        user: { id: dto.userId },
        leftAt: IsNull(),
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
      // Une invitation est déjà en attente pour ce joueur : éviter les doublons (notification + spam).
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
    this.notifications.notifyUser(dto.userId, 'rooms.invite.received', {
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

  async invitePresenceList(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomInvitePresenceListDto, payload ?? {});

    const room = await this.roomRepo.findOne({
      where: { id: dto.roomId },
      relations: ['owner'],
    });
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    if (!room.owner || room.owner.id !== user.id) {
      throw new ForbiddenException('Seul le propriétaire peut inviter');
    }

    const activeParticipantIds = new Set<number>(
      (
        await this.participantRepo
          .createQueryBuilder('p')
          .select('p.user_id', 'userId')
          .where('p.room_id = :roomId', { roomId: room.id })
          .andWhere('p.left_at IS NULL')
          .getRawMany()
      )
        .map((r: any) => Number(r?.userId ?? 0))
        .filter((id) => Number.isFinite(id) && id > 0),
    );

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
      .sort((a, b) =>
        a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }),
      );

    return {
      type: 'rooms.invite.presence.listed',
      payload: { roomId: dto.roomId, players },
    };
  }

  async inviteRespond(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomInviteRespondDto, payload);
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
      throw new ForbiddenException('Invitation non destinée à cet utilisateur');
    }
    if (!dto.accept) {
      this.invites.delete(dto.invitationId);
      this.notifications.notifyUser(
        invite.fromUserId,
        'rooms.invite.responded',
        {
          invitationId: dto.invitationId,
          roomId: invite.roomId,
          accepted: false,
          by: { id: user.id, username: user.username },
        },
      );
      return {
        type: 'rooms.invite.responded',
        payload: { invitationId: dto.invitationId, accepted: false },
      };
    }

    const current = await this.rooms.getRoomPayload(invite.roomId);
    const started =
      (current.room.status || '').toLowerCase() === 'started' ||
      Boolean(current.room.startedAt);
    if (started) {
      // Table déjà démarrée : l'invité rejoint en spectateur (même table privée).
      this.invites.consume(dto.invitationId, { keep: true });
      // Best-effort: rafraîchir la room côté propriétaire (ex: afficher un badge "spectateur accepté").
      try {
        await this.rooms.notifyRoomStateUpdated(invite.roomId);
      } catch {
        // ignore
      }
      this.notifications.notifyUser(
        invite.fromUserId,
        'rooms.invite.responded',
        {
          invitationId: dto.invitationId,
          roomId: invite.roomId,
          accepted: true,
          by: { id: user.id, username: user.username },
        },
      );
      return {
        type: 'rooms.invite.accepted',
        payload: { roomId: invite.roomId, room: current.room, spectator: true },
      };
    }

    // accept: join first, then consume the invitation (one-shot) only on success
    try {
      await this.rooms.joinRoom(invite.roomId, user.id, { allowPrivate: true });
      this.invites.consume(dto.invitationId);
      // Important: prévenir les clients déjà connectés à la table (propriétaire) pour que le roster se mette à jour.
      try {
        await this.rooms.notifyRoomStateUpdated(invite.roomId);
      } catch {
        // ignore
      }
    } catch (err) {
      const msg = String((err as Error)?.message ?? '');
      const msgLower = msg.toLowerCase();
      if (msgLower.includes('démarr') || msgLower.includes('demarr')) {
        const state = await this.rooms.getRoomPayload(invite.roomId);
        this.invites.consume(dto.invitationId, { keep: true });
        try {
          await this.rooms.notifyRoomStateUpdated(invite.roomId);
        } catch {
          // ignore
        }
        this.notifications.notifyUser(
          invite.fromUserId,
          'rooms.invite.responded',
          {
            invitationId: dto.invitationId,
            roomId: invite.roomId,
            accepted: true,
            by: { id: user.id, username: user.username },
          },
        );
        return {
          type: 'rooms.invite.accepted',
          payload: { roomId: invite.roomId, room: state.room, spectator: true },
        };
      }
      throw err;
    }

    const state = await this.rooms.getRoomPayload(invite.roomId);
    this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
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
}
