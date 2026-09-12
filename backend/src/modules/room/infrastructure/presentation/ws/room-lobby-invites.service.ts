import { Inject, Injectable } from '@nestjs/common';
import { bestEffort } from '../../../../../platform/observability/public-api';
import { getErrorMessage } from '../../../../../shared/utils/public-api';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from '../../../../notification/public-api';
import { PresenceService } from '../../../../presence/public-api';
import type { RoomPayload } from '../../../application/models/room-payload.model';
import {
  ROOM_LOBBY_REPOSITORY,
  type RoomLobbyRepository,
} from '../../../application/ports/room-lobby.repository';
import {
  type RoomInvite,
  RoomInviteService,
} from '../../../application/services/membership/room-invite.service';
import { RoomLobbyPolicyService } from '../../../application/services/lobby/room-lobby-policy.service';
import { RoomMembershipFacadeService } from '../../../application/services/membership/room-membership-facade.service';
import { RoomStateService } from '../../../application/services/state/room-state.service';
import type {
  RoomInvitePresenceListDto,
  RoomInviteRespondDto,
  RoomInviteSendDto,
} from './dto/room-invite.ws.dto';
import { RoomLobbyPresenter } from './room-lobby.presenter';
import type { LobbyUser } from './room-lobby.types';

@Injectable()
export class RoomLobbyInvitesService {
  constructor(
    private readonly membership: RoomMembershipFacadeService,
    private readonly roomState: RoomStateService,
    private readonly policy: RoomLobbyPolicyService,
    private readonly invites: RoomInviteService,
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly notifications: NotificationDispatcher,
    private readonly presence: PresenceService,
    private readonly presenter: RoomLobbyPresenter,
    @Inject(ROOM_LOBBY_REPOSITORY)
    private readonly lobbyRepo: RoomLobbyRepository,
  ) {}

  async send(user: LobbyUser, dto: RoomInviteSendDto) {
    const room = this.policy.requireOwnedRoom(
      await this.lobbyRepo.findRoomWithOwner(dto.roomId),
      user.id,
    );
    if (await this.lobbyRepo.hasActiveParticipant(room.id, dto.userId)) {
      return this.presenter.presentInviteSent({
        roomId: room.id,
        userId: dto.userId,
        alreadyInRoom: true,
      });
    }
    const existing = await this.invites.findActive(room.id, dto.userId);
    if (existing) {
      return this.presenter.presentInviteSent(
        this.presenter.presentExistingInvite(room, existing),
      );
    }
    const invite = await this.invites.create(room.id, user.id, dto.userId);
    await this.notifications.notifyUser(
      dto.userId,
      'room.lobby.invite.received',
      {
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
      },
    );
    return this.presenter.presentInviteSent({
      invitationId: invite.id,
      roomId: room.id,
      userId: dto.userId,
    });
  }

  async listPresence(user: LobbyUser, dto: RoomInvitePresenceListDto) {
    const room = this.policy.requireOwnedRoom(
      await this.lobbyRepo.findRoomWithOwner(dto.roomId),
      user.id,
    );
    const activeIds = new Set<number>(
      await this.lobbyRepo.listActiveParticipantUserIds(room.id),
    );
    const candidates = this.presence
      .listPlayers()
      .filter((player) => player.id !== user.id)
      .filter((player) => player.availability !== 'absent')
      .filter((player) => !activeIds.has(player.id))
      .slice(0, 1_000);
    const pendingRecipientIds = new Set(
      await this.invites.activeRecipientIds(
        room.id,
        candidates.map((player) => player.id),
      ),
    );
    const players = candidates
      .map((player) => ({
        id: player.id,
        username: player.username,
        availability: player.availability ?? null,
        location: player.location ?? null,
        currentRoom: player.currentRoom ?? null,
        pendingInvite: pendingRecipientIds.has(player.id),
      }))
      .sort((left, right) =>
        left.username.localeCompare(right.username, undefined, {
          sensitivity: 'base',
        }),
      );
    return this.presenter.presentInvitePresenceList(dto.roomId, players);
  }

  async respond(user: LobbyUser, dto: RoomInviteRespondDto) {
    const invite = this.policy.requireInviteRecipient(
      await this.invites.get(dto.invitationId),
      user.id,
    );
    if (!invite) {
      return this.presenter.presentInviteResponded({
        invitationId: dto.invitationId,
        accepted: false,
        expired: true,
      });
    }
    if (dto.accept) {
      return this.accept(user, invite, dto.invitationId);
    }
    await this.invites.delete(dto.invitationId);
    await this.notifyResponse(invite, dto.invitationId, user, false);
    return this.presenter.presentInviteResponded({
      invitationId: dto.invitationId,
      accepted: false,
    });
  }

  private async accept(
    user: LobbyUser,
    invite: RoomInvite,
    invitationId: string,
  ) {
    const current = await this.roomState.getRoomPayload(invite.roomId);
    if (this.isStarted(current)) {
      return this.acceptAsSpectator(user, invite, invitationId, current.room);
    }
    try {
      await this.membership.joinRoom(invite.roomId, user.id, {
        allowPrivate: true,
      });
      await this.invites.consume(invitationId);
      await this.refreshRoom(invite.roomId);
    } catch (error) {
      if (!getErrorMessage(error, '').toLowerCase().includes('demarr')) {
        throw error;
      }
      const state = await this.roomState.getRoomPayload(invite.roomId);
      return this.acceptAsSpectator(user, invite, invitationId, state.room);
    }
    const state = await this.roomState.getRoomPayload(invite.roomId);
    await this.notifyResponse(invite, invitationId, user, true);
    return this.presenter.presentInviteAccepted(
      invite.roomId,
      state.room,
      false,
    );
  }

  private async acceptAsSpectator(
    user: LobbyUser,
    invite: RoomInvite,
    invitationId: string,
    room: RoomPayload['room'],
  ) {
    await this.invites.consume(invitationId, { keep: true });
    await this.refreshRoom(invite.roomId);
    await this.notifyResponse(invite, invitationId, user, true);
    return this.presenter.presentInviteAccepted(invite.roomId, room, true);
  }

  private async notifyResponse(
    invite: RoomInvite,
    invitationId: string,
    user: LobbyUser,
    accepted: boolean,
  ): Promise<void> {
    await this.notifications.notifyUser(
      invite.fromUserId,
      'room.lobby.invite.responded',
      {
        invitationId,
        roomId: invite.roomId,
        accepted,
        by: { id: user.id, username: user.username },
      },
    );
  }

  private async refreshRoom(roomId: number): Promise<void> {
    await bestEffort(
      this.roomState.notifyRoomStateUpdated(roomId),
      `rafraîchissement room après invitation room=${roomId}`,
    );
  }

  private isStarted(state: RoomPayload): boolean {
    return (
      String(state.room.status ?? '').toLowerCase() === 'started' ||
      Boolean(state.room.startedAt)
    );
  }
}
