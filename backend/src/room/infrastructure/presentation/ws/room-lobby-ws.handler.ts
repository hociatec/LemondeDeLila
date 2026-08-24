import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { requireUser } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from '../../../../notification/public-api';
import {
  ROOM_LOBBY_REPOSITORY,
  type RoomLobbyRepository,
} from '../../../application/ports/room-lobby.repository';
import { RoomLobbyPolicyService } from '../../../application/services/room-lobby-policy.service';
import {
  RoomsPublicJoinDto,
  RoomsPublicListDto,
} from './dto/rooms-public.ws.dto';
import {
  RoomInvitePresenceListDto,
  RoomInviteRespondDto,
  RoomInviteSendDto,
} from './dto/room-invite.ws.dto';
import { RoomMembershipFacadeService } from '../../../application/services/room-membership-facade.service';
import { RoomStateService } from '../../../application/services/room-state.service';
import { RoomInviteService } from '../../../application/services/room-invite.service';
import { buildPublicRoomList } from './room-lobby-list.helpers';
import { CatalogService } from '../../../../catalog/public-api';
import { RoomLobbyRefreshService } from '../../../application/services/room-lobby-refresh.service';
import { RoomRealtimeTrackerService } from '../../../application/services/room-realtime-tracker.service';
import { PresenceService } from '../../../../presence/public-api';
import { RoomLobbyPresenter } from './room-lobby.presenter';

type LobbyWsVariant = 'legacy' | 'lobby';
type CatalogGameLike = { id: string; status?: unknown };

@Injectable()
export class RoomLobbyWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly membership: RoomMembershipFacadeService,
    private readonly roomState: RoomStateService,
    private readonly policy: RoomLobbyPolicyService,
    private readonly invites: RoomInviteService,
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly notifications: NotificationDispatcher,
    private readonly catalog: CatalogService,
    private readonly lobbyRefresh: RoomLobbyRefreshService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly presence: PresenceService,
    private readonly presenter: RoomLobbyPresenter,
    @Inject(ROOM_LOBBY_REPOSITORY)
    private readonly lobbyRepo: RoomLobbyRepository,
  ) {}

  private requireConnectionId(session: WsSession): string {
    const connectionId = session.connectionId?.trim();
    if (!connectionId) {
      throw new ForbiddenException('Session WS invalide');
    }
    return connectionId;
  }

  async listPublic(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicListDto, payload);
    const isAdmin = Array.isArray(user.roles)
      ? user.roles.includes('ROLE_ADMIN') || user.roles.includes('admin')
      : false;
    const allowedGames = (await this.catalog.getAllGames()).filter((g) => {
      const game = g as CatalogGameLike;
      const status = String(game.status ?? 'finished').toLowerCase();
      if (status === 'construction') {
        return isAdmin;
      }
      return true;
    });
    const allowed = new Set(allowedGames.map((g) => g.id));
    if (!this.policy.ensureGameTypeAllowed(dto.gameType, allowed)) {
      return this.presenter.presentPublicList(variant, {
        items: [],
        groups: [],
      });
    }

    const rooms = await this.lobbyRepo.listPublicRooms({
      gameType: dto.gameType ?? null,
    });
    const activeRoomIds = new Set(this.realtimeTracker.getActivePlayerRoomIds());
    const activeRooms = rooms.filter((room) => activeRoomIds.has(room.id));
    const built = buildPublicRoomList(activeRooms, {
      allowedGameTypes: allowed,
    });
    const isBanned = (roomId: number) => this.roomState.isBanned(roomId, user.id);
    built.items = built.items.map((item) => ({ ...item, banned: isBanned(item.id) }));
    built.groups = built.groups.map((group) => ({
      ...group,
      rooms: group.rooms.map((item) => ({
        ...item,
        banned: isBanned(item.id),
      })),
    }));

    return this.presenter.presentPublicList(variant, built);
  }

  async joinPublic(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    this.policy.ensureNotBanned(this.roomState.isBanned(dto.roomId, user.id));
    await this.membership.joinRoom(dto.roomId, user.id);
    const state = await this.roomState.getRoomPayload(dto.roomId);
    return this.presenter.presentJoinResult(
      variant,
      'joined',
      dto.roomId,
      state.room,
    );
  }

  async leavePublic(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    const room = await this.membership.leaveRoom(dto.roomId, user.id);
    if (!room) {
      return this.presenter.presentJoinResult(
        variant,
        'left',
        dto.roomId,
        undefined,
        true,
      );
    }

    const state = await this.roomState.getRoomPayload(dto.roomId);
    return this.presenter.presentJoinResult(
      variant,
      'left',
      dto.roomId,
      state.room,
    );
  }

  async spectatePublic(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    const state = await this.roomState.getRoomPayload(dto.roomId);
    this.policy.ensureSpectatingAllowed(state);
    return this.presenter.presentJoinResult(
      variant,
      'spectated',
      dto.roomId,
      state.room,
    );
  }

  async subscribePublic(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    requireUser(session);
    const connectionId = this.requireConnectionId(session);
    const dto = this.validator.validate(RoomsPublicListDto, payload);
    this.lobbyRefresh.subscribe(connectionId, dto.gameType ?? null, variant);
    const listed = await this.listPublic(session, payload, variant);
    return this.presenter.presentSubscription(
      variant,
      'subscribed',
      listed.payload,
    );
  }

  async unsubscribePublic(
    session: WsSession,
    variant: LobbyWsVariant = 'legacy',
  ) {
    requireUser(session);
    this.lobbyRefresh.unsubscribe(this.requireConnectionId(session));
    return this.presenter.presentSubscription(variant, 'unsubscribed', {
      ok: true,
    });
  }

  async inviteSend(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomInviteSendDto, payload);
    const room = this.policy.requireOwnedRoom(
      await this.lobbyRepo.findRoomWithOwner(dto.roomId),
      user.id,
    );

    const existingParticipant = await this.lobbyRepo.hasActiveParticipant(
      room.id,
      dto.userId,
    );
    if (existingParticipant) {
      return this.presenter.presentInviteSent(variant, {
        roomId: room.id,
        userId: dto.userId,
        alreadyInRoom: true,
      });
    }

    const existingInvite = this.invites.findActive(room.id, dto.userId);
    if (existingInvite) {
      return this.presenter.presentInviteSent(
        variant,
        this.presenter.presentExistingInvite(room, existingInvite),
      );
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

    return this.presenter.presentInviteSent(variant, {
      invitationId: invite.id,
      roomId: room.id,
      userId: dto.userId,
    });
  }

  async invitePresenceList(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(
      RoomInvitePresenceListDto,
      payload ?? {},
    );

    const room = this.policy.requireOwnedRoom(
      await this.lobbyRepo.findRoomWithOwner(dto.roomId),
      user.id,
    );

    const activeParticipantIds = new Set<number>(
      await this.lobbyRepo.listActiveParticipantUserIds(room.id),
    );

    const players = this.presence
      .listPlayers()
      .filter((player) => player.id !== user.id)
      .filter((player) => player.availability !== 'absent')
      .filter((player) => !activeParticipantIds.has(player.id))
      .map((player) => ({
        id: player.id,
        username: player.username,
        availability: player.availability ?? null,
        location: player.location ?? null,
        currentRoom: player.currentRoom ?? null,
        pendingInvite: Boolean(this.invites.findActive(room.id, player.id)),
      }))
      .sort((a, b) =>
        a.username.localeCompare(b.username, undefined, {
          sensitivity: 'base',
        }),
      );

    return this.presenter.presentInvitePresenceList(
      variant,
      dto.roomId,
      players,
    );
  }

  async inviteRespond(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomInviteRespondDto, payload);
    const invite = this.policy.requireInviteRecipient(
      this.invites.get(dto.invitationId),
      user.id,
    );
    if (!invite) {
      return this.presenter.presentInviteResponded(variant, {
        invitationId: dto.invitationId,
        accepted: false,
        expired: true,
      });
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
      return this.presenter.presentInviteResponded(variant, {
        invitationId: dto.invitationId,
        accepted: false,
      });
    }

    const current = await this.roomState.getRoomPayload(invite.roomId);
    const started =
      (current.room.status || '').toLowerCase() === 'started' ||
      Boolean(current.room.startedAt);
    if (started) {
      this.invites.consume(dto.invitationId, { keep: true });
      try {
        await this.roomState.notifyRoomStateUpdated(invite.roomId);
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
      return this.presenter.presentInviteAccepted(
        variant,
        invite.roomId,
        current.room,
        true,
      );
    }

    try {
      await this.membership.joinRoom(invite.roomId, user.id, {
        allowPrivate: true,
      });
      this.invites.consume(dto.invitationId);
      try {
        await this.roomState.notifyRoomStateUpdated(invite.roomId);
      } catch {
        // ignore
      }
    } catch (error) {
      const message = String((error as Error)?.message ?? '').toLowerCase();
      if (message.includes('demarr')) {
        const state = await this.roomState.getRoomPayload(invite.roomId);
        this.invites.consume(dto.invitationId, { keep: true });
        try {
          await this.roomState.notifyRoomStateUpdated(invite.roomId);
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
        return this.presenter.presentInviteAccepted(
          variant,
          invite.roomId,
          state.room,
          true,
        );
      }
      throw error;
    }

    const state = await this.roomState.getRoomPayload(invite.roomId);
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
    return this.presenter.presentInviteAccepted(
      variant,
      invite.roomId,
      state.room,
      false,
    );
  }
}

