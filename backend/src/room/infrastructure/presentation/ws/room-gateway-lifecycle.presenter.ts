import { Injectable } from '@nestjs/common';
import type { RoomIntent } from './dto/room-intent.ws.dto';
import type { RoomPayload } from '../../../application/models/room-payload.model';
import type { ClientMeta } from './room-gateway.types';

@Injectable()
export class RoomGatewayLifecyclePresenter {
  presentStateUpdated(roomId: number) {
    return { roomId };
  }

  presentPrivacyUpdated(state: RoomPayload) {
    return {
      isPrivate: state.room.isPrivate,
      room: state.room,
    };
  }

  presentPrivacyAnnouncement(state: RoomPayload): RoomIntent {
    return {
      type: 'announcement',
      payload: {
        message: state.room.isPrivate ? 'Table privee.' : 'Table publique.',
      },
    };
  }

  presentCreatedRoom(
    roomId: number,
    payload: RoomPayload,
    meta: ClientMeta,
    withAllowedActionsForClient: (
      nextPayload: RoomPayload,
      nextMeta: ClientMeta,
    ) => RoomPayload,
  ) {
    return {
      type: 'room.created',
      roomId,
      payload: withAllowedActionsForClient(payload, meta),
    };
  }

  presentJoinBannedError(): string {
    return 'Banni de cette table.';
  }

  presentSilentModeForbiddenReason(): string {
    return 'Mode cache reserve aux admins';
  }

  presentSpectatorForbiddenReason(): string {
    return 'Spectateur non autorise sur cette table';
  }

  presentRolePromoted(roomId: number) {
    return {
      type: 'room.role',
      roomId,
      payload: {
        spectator: false,
        message: 'Mode spectateur desactive.',
      },
    };
  }
}
