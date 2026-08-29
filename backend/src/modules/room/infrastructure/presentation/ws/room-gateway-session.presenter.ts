import { Injectable } from '@nestjs/common';
import type { RoomPayload } from '../../../application/models/room-payload.model';

@Injectable()
export class RoomGatewaySessionPresenter {
  presentChatHistory(roomId: number, messages: unknown[]) {
    return {
      type: 'room.chat.history',
      roomId,
      payload: { messages },
    };
  }

  presentNoRoomError(): string {
    return 'Vous n etes pas dans une table.';
  }

  presentRoomChatDisabledError(): string {
    return 'Chat desactive pour ce jeu.';
  }

  presentRoomChatCooldownError(): string {
    return 'Trop rapide. Attendez un instant.';
  }

  presentRoomInfo(roomId: number, message: string) {
    return {
      type: 'room.info',
      roomId,
      payload: { message },
    };
  }

  presentRoomLeft(roomId: number, payload: RoomPayload) {
    return {
      type: 'room.left',
      roomId,
      payload,
    };
  }

  presentRoomDeleted(roomId: number) {
    return { type: 'room.deleted', roomId };
  }
}
