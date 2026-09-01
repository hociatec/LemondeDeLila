import { Injectable } from '@nestjs/common';
import type { RoomPayload } from '../../../application/contracts/room-payload.model';
import type { RoomRecord } from '../../../application/contracts/room-record.model';
import type { RoomInvite } from '../../../application/services/membership/room-invite.service';

@Injectable()
export class RoomLobbyPresenter {
  presentPublicList(payload: { items: unknown[]; groups: unknown[] }) {
    return {
      type: 'room.lobby.listed',
      payload,
    };
  }

  presentJoinResult(
    type: 'joined' | 'left' | 'spectated',
    roomId: number,
    room?: RoomPayload['room'],
    deleted = false,
  ) {
    const suffix =
      type === 'joined' ? 'joined' : type === 'left' ? 'left' : 'spectated';
    return {
      type: `room.lobby.${suffix}`,
      payload: room ? { roomId, room } : { roomId, deleted },
    };
  }

  presentSubscription(action: 'subscribed' | 'unsubscribed', payload: unknown) {
    return {
      type: `room.lobby.${action}`,
      payload,
    };
  }

  presentInviteSent(payload: Record<string, unknown>) {
    return {
      type: 'room.lobby.invite.sent',
      payload,
    };
  }

  presentInvitePresenceList(roomId: number, players: unknown[]) {
    return {
      type: 'room.lobby.invite.presence.listed',
      payload: { roomId, players },
    };
  }

  presentInviteResponded(payload: Record<string, unknown>) {
    return {
      type: 'room.lobby.invite.responded',
      payload,
    };
  }

  presentInviteAccepted(
    roomId: number,
    room: RoomPayload['room'],
    spectator: boolean,
  ) {
    return {
      type: 'room.lobby.invite.accepted',
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
