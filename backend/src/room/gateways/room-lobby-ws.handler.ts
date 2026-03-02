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
import { buildPublicRoomList } from '../utils/room-lobby.utils';
import { CatalogService } from '../../catalog/services/catalog.service';
import { RoomLobbyRefreshService } from '../services/room-lobby-refresh.service';
import { RoomRealtimeTrackerService } from '../services/room-realtime-tracker.service';
import { PresenceService } from '../../presence/services/presence.service';

type LobbyWsVariant = 'legacy' | 'lobby';

@Injectable()
export class RoomLobbyWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly rooms: RoomService,
    private readonly invites: RoomInviteService,
    private readonly notifications: NotificationService,
    private readonly catalog: CatalogService,
    private readonly lobbyRefresh: RoomLobbyRefreshService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly presence: PresenceService,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participantRepo: Repository<RoomParticipant>,
  ) {}

  private mapType(
    variant: LobbyWsVariant,
    legacyType: string,
    lobbyType: string,
  ): string {
    return variant === 'lobby' ? lobbyType : legacyType;
  }

  async listPublic(
    session: WsSession,
    payload: any,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicListDto, payload);
    const isAdmin = Array.isArray(user.roles)
      ? user.roles.includes('ROLE_ADMIN') || user.roles.includes('admin')
      : false;
    const allowedGames = (await this.catalog.getAllGames()).filter((g) => {
      const status = String((g as any)?.status ?? 'finished').toLowerCase();
      if (status === 'construction') {
        return isAdmin;
      }
      return true;
    });
    const allowed = new Set(allowedGames.map((g) => g.id));
    if (dto.gameType && !allowed.has(dto.gameType)) {
      return {
        type: this.mapType(variant, 'rooms.public.listed', 'room.lobby.listed'),
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
    return {
      type: this.mapType(variant, 'rooms.public.listed', 'room.lobby.listed'),
      payload: built,
    };
  }

  async joinPublic(
    session: WsSession,
    payload: any,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    if (this.rooms.isBanned(dto.roomId, user.id)) {
      throw new ForbiddenException('Banni de cette table');
    }
    await this.rooms.joinRoom(dto.roomId, user.id);
    const state = await this.rooms.getRoomPayload(dto.roomId);
    return {
      type: this.mapType(variant, 'rooms.public.joined', 'room.lobby.joined'),
      payload: { roomId: dto.roomId, room: state.room },
    };
  }

  async leavePublic(
    session: WsSession,
    payload: any,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    const room = await this.rooms.leaveRoom(dto.roomId, user.id);
    if (!room) {
      return {
        type: this.mapType(variant, 'rooms.public.left', 'room.lobby.left'),
        payload: { roomId: dto.roomId, deleted: true },
      };
    }
    const state = await this.rooms.getRoomPayload(dto.roomId);
    return {
      type: this.mapType(variant, 'rooms.public.left', 'room.lobby.left'),
      payload: { roomId: dto.roomId, room: state.room },
    };
  }

  async spectatePublic(
    session: WsSession,
    payload: any,
    variant: LobbyWsVariant = 'legacy',
  ) {
    requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    const state = await this.rooms.getRoomPayload(dto.roomId);
    if (state.room.isPrivate) {
      throw new ForbiddenException(
        'Spectateurs interdits sur les tables privées',
      );
    }
    return {
      type: this.mapType(
        variant,
        'rooms.public.spectated',
        'room.lobby.spectated',
      ),
      payload: { roomId: dto.roomId, room: state.room },
    };
  }

  async subscribePublic(
    session: WsSession,
    payload: any,
    variant: LobbyWsVariant = 'legacy',
  ) {
    requireUser(session);
    const dto = this.validator.validate(RoomsPublicListDto, payload);
    this.lobbyRefresh.subscribe(
      session.connectionId,
      dto.gameType ?? null,
      variant,
    );
    const listed = await this.listPublic(session, payload, variant);
    return {
      type: this.mapType(
        variant,
        'rooms.public.subscribed',
        'room.lobby.subscribed',
      ),
      payload: listed.payload,
    };
  }

  async unsubscribePublic(
    session: WsSession,
    variant: LobbyWsVariant = 'legacy',
  ) {
    requireUser(session);
    this.lobbyRefresh.unsubscribe(session.connectionId);
    return {
      type: this.mapType(
        variant,
        'rooms.public.unsubscribed',
        'room.lobby.unsubscribed',
      ),
      payload: { ok: true },
    };
  }

  async inviteSend(
    session: WsSession,
    payload: any,
    variant: LobbyWsVariant = 'legacy',
  ) {
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
        type: this.mapType(
          variant,
          'rooms.invite.sent',
          'room.lobby.invite.sent',
        ),
        payload: { roomId: room.id, userId: dto.userId, alreadyInRoom: true },
      };
    }
    const existingInvite = this.invites.findActive(room.id, dto.userId);
    if (existingInvite) {
      // Une invitation est déjà en attente pour ce joueur : éviter les doublons (notification + spam).
      return {
        type: this.mapType(
          variant,
          'rooms.invite.sent',
          'room.lobby.invite.sent',
        ),
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
      type: this.mapType(
        variant,
        'rooms.invite.sent',
        'room.lobby.invite.sent',
      ),
      payload: { invitationId: invite.id, roomId: room.id, userId: dto.userId },
    };
  }

  async invitePresenceList(
    session: WsSession,
    payload: any,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(
      RoomInvitePresenceListDto,
      payload ?? {},
    );

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
        a.username.localeCompare(b.username, undefined, {
          sensitivity: 'base',
        }),
      );

    return {
      type: this.mapType(
        variant,
        'rooms.invite.presence.listed',
        'room.lobby.invite.presence.listed',
      ),
      payload: { roomId: dto.roomId, players },
    };
  }

  async inviteRespond(
    session: WsSession,
    payload: any,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomInviteRespondDto, payload);
    const invite = this.invites.get(dto.invitationId);
    if (!invite) {
      return {
        type: this.mapType(
          variant,
          'rooms.invite.responded',
          'room.lobby.invite.responded',
        ),
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
      void this.notifications.notifyUser(
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
        type: this.mapType(
          variant,
          'rooms.invite.responded',
          'room.lobby.invite.responded',
        ),
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
      void this.notifications.notifyUser(
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
        type: this.mapType(
          variant,
          'rooms.invite.accepted',
          'room.lobby.invite.accepted',
        ),
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
        void this.notifications.notifyUser(
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
          type: this.mapType(
            variant,
            'rooms.invite.accepted',
            'room.lobby.invite.accepted',
          ),
          payload: { roomId: invite.roomId, room: state.room, spectator: true },
        };
      }
      throw err;
    }

    const state = await this.rooms.getRoomPayload(invite.roomId);
    void this.notifications.notifyUser(
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
      type: this.mapType(
        variant,
        'rooms.invite.accepted',
        'room.lobby.invite.accepted',
      ),
      payload: { roomId: invite.roomId, room: state.room, spectator: false },
    };
  }
}
