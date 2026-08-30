import { Injectable } from '@nestjs/common';
import type { RoomPayload } from '../../../application/contracts/room-payload.model';
import type { RoomRecord } from '../../../application/contracts/room-record.model';
import type { RoomInvite } from '../../../application/services/membership/room-invite.service';

type LobbyWsVariant = 'legacy' | 'lobby';

@Injectable()
export class RoomLobbyPresenter {
  mapType(
    variant: LobbyWsVariant,
    legacyType: string,
    lobbyType: string,
  ): string {
    return variant === 'lobby' ? lobbyType : legacyType;
  }

  presentPublicList(
    variant: LobbyWsVariant,
    payload: { items: unknown[]; groups: unknown[] },
  ) {
    return {
      type: this.mapType(variant, 'rooms.public.listed', 'room.lobby.listed'),
      payload,
    };
  }

  presentJoinResult(
    variant: LobbyWsVariant,
    type: 'joined' | 'left' | 'spectated',
    roomId: number,
    room?: RoomPayload['room'],
    deleted = false,
  ) {
    const suffix =
      type === 'joined' ? 'joined' : type === 'left' ? 'left' : 'spectated';
    return {
      type: this.mapType(
        variant,
        `rooms.public.${suffix}`,
        `room.lobby.${suffix}`,
      ),
      payload: room ? { roomId, room } : { roomId, deleted },
    };
  }

  presentSubscription(
    variant: LobbyWsVariant,
    action: 'subscribed' | 'unsubscribed',
    payload: unknown,
  ) {
    return {
      type: this.mapType(
        variant,
        `rooms.public.${action}`,
        `room.lobby.${action}`,
      ),
      payload,
    };
  }

  presentInviteSent(variant: LobbyWsVariant, payload: Record<string, unknown>) {
    return {
      type: this.mapType(
        variant,
        'rooms.invite.sent',
        'room.lobby.invite.sent',
      ),
      payload,
    };
  }

  presentInvitePresenceList(
    variant: LobbyWsVariant,
    roomId: number,
    players: unknown[],
  ) {
    return {
      type: this.mapType(
        variant,
        'rooms.invite.presence.listed',
        'room.lobby.invite.presence.listed',
      ),
      payload: { roomId, players },
    };
  }

  presentInviteResponded(
    variant: LobbyWsVariant,
    payload: Record<string, unknown>,
  ) {
    return {
      type: this.mapType(
        variant,
        'rooms.invite.responded',
        'room.lobby.invite.responded',
      ),
      payload,
    };
  }

  presentInviteAccepted(
    variant: LobbyWsVariant,
    roomId: number,
    room: RoomPayload['room'],
    spectator: boolean,
  ) {
    return {
      type: this.mapType(
        variant,
        'rooms.invite.accepted',
        'room.lobby.invite.accepted',
      ),
      payload: { roomId, room, spectator },
    };
  }

  presentExistingInvite(room: RoomRecord, invite: RoomInvite) {
    return {
      invitationId: invite.id,
      roomId: room.id,
      userId: invite.toUserId,
      pending: true,
      expiresAt: invite.expiresAt,
    };
  }
}
