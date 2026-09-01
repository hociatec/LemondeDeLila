import { Injectable } from '@nestjs/common';
import type { RoomPayload } from '../../../application/contracts/room-payload.model';
import type { RoomFocusIntent } from './dto/room-focus-intent.ws.dto';
import type {
  RoomIntent,
  RoomStartWizardIntent,
} from './dto/room-intent.ws.dto';
import type { PresentedErrorPayload } from '@shared/utils/public-api';

@Injectable()
export class RoomGatewayStatePresenter {
  presentStateUpdated(roomId: number) {
    return {
      type: 'state-updated',
      roomId,
      payload: { roomId },
    };
  }

  presentRoomUpdated(roomId: number, payload: RoomPayload) {
    return {
      type: 'room.updated',
      roomId,
      payload,
    };
  }

  presentRoomFocus(roomId: number, payload: RoomFocusIntent) {
    return {
      type: 'room.focus',
      roomId,
      payload,
    };
  }

  presentRoomIntent(roomId: number, payload: RoomIntent) {
    return {
      type: 'room.intent',
      roomId,
      payload,
    };
  }

  presentFocusIntent(payload: RoomFocusIntent): RoomIntent {
    return {
      type: 'focus',
      payload,
    };
  }

  presentFocusAnnouncement(payload: RoomFocusIntent): RoomIntent {
    return {
      type: 'announcement',
      payload: {
        message:
          payload.reason === 'room.started'
            ? 'La partie démarre, bon jeu !'
            : 'Mise à jour de la table en cours.',
        priority: payload.priority === 'assertive' ? 'assertive' : 'polite',
      },
    };
  }

  presentStartWizardIntent(payload: RoomStartWizardIntent): RoomIntent {
    return {
      type: 'start-wizard',
      payload,
    };
  }

  presentCreationAnnouncement(gameName: string): RoomIntent {
    return {
      type: 'announcement',
      payload: {
        message:
          gameName.length === 0
            ? 'Table créée. Ajoutez des bots et commencez à jouer.'
            : `Table de ${gameName} créée. Ajoutez des bots et commencez à jouer.`,
      },
    };
  }

  presentAnnouncement(
    message: string,
    priority: 'polite' | 'assertive' = 'polite',
  ): RoomIntent {
    return {
      type: 'announcement',
      payload: {
        message,
        priority,
      },
    };
  }

  presentError(error: string | PresentedErrorPayload, roomId?: number) {
    return {
      type: 'error',
      ...(typeof roomId === 'number' ? { roomId } : {}),
      payload: typeof error === 'string' ? { message: error } : error,
    };
  }
}
