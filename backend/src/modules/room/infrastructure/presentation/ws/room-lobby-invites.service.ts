import { Inject, Injectable } from '@nestjs/common';
import { bestEffort, getErrorMessage } from '@shared/utils/public-api';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from '../../../../notification/public-api';
import { PresenceService } from '../../../../presence/public-api';
import type { RoomPayload } from '../../../application/contracts/room-payload.model';
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
    const existing = this.invites.findActive(room.id, dto.userId);
    if (existing) {
      return this.presenter.presentInviteSent(
        this.presenter.presentExistingInvite(room, existing),
      );
    }
    const invite = this.invites.create(room.id, user.id, dto.userId);
    void this.notifications.notifyUser(
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
    const players = this.presence
      .listPlayers()
      .filter((player) => player.id !== user.id)
      .filter((player) => player.availability !== 'absent')
      .filter((player) => !activeIds.has(player.id))
      .map((player) => ({
        id: player.id,
        username: player.username,
        availability: player.availability ?? null,
        location: player.location ?? null,
        currentRoom: player.currentRoom ?? null,
        pendingInvite: Boolean(this.invites.findActive(room.id, player.id)),
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
      this.invites.get(dto.invitationId),
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
    this.invites.delete(dto.invitationId);
    this.notifyResponse(invite, dto.invitationId, user, false);
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
      this.invites.consume(invitationId);
      await this.refreshRoom(invite.roomId);
    } catch (error) {
      if (!getErrorMessage(error, '').toLowerCase().includes('demarr')) {
        throw error;
      }
      const state = await this.roomState.getRoomPayload(invite.roomId);
      return this.acceptAsSpectator(user, invite, invitationId, state.room);
    }
    const state = await this.roomState.getRoomPayload(invite.roomId);
    this.notifyResponse(invite, invitationId, user, true);
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
    this.invites.consume(invitationId, { keep: true });
    await this.refreshRoom(invite.roomId);
    this.notifyResponse(invite, invitationId, user, true);
    return this.presenter.presentInviteAccepted(invite.roomId, room, true);
  }

  private notifyResponse(
    invite: RoomInvite,
    invitationId: string,
    user: LobbyUser,
    accepted: boolean,
  ): void {
    void this.notifications.notifyUser(
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
