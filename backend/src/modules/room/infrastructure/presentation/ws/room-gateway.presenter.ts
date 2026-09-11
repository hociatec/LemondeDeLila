import { presentationTimestamp } from '../../../../../platform/serialization/public-api';
import { Injectable } from '@nestjs/common';
import type { RoomPayload } from '../../../application/models/room-payload.model';
import type { RoomIntent } from './dto/room-intent.ws.dto';

@Injectable()
export class RoomGatewayPresenter {
  presentBotAdded(roomId: number, bot: { id: number; name: string }) {
    return {
      roomId,
      bot: { id: bot.id, name: bot.name },
    };
  }

  presentBotRemoved(
    roomId: number,
    bot: { id: number; name: string },
    botId: number,
  ) {
    return {
      roomId,
      bot: { id: bot.id, name: bot.name },
      botId,
    };
  }

  updateRoomPayloadWithAddedBot(
    payload: RoomPayload,
    bot: { id: number; name: string },
  ): RoomPayload {
    const bots = payload.room.bots ?? [];
    return {
      ...payload,
      generatedAt: presentationTimestamp(),
      room: {
        ...payload.room,
        bots: bots.some((candidate) => candidate.id === bot.id)
          ? [...bots]
          : [...bots, { id: bot.id, name: bot.name }],
      },
    };
  }

  updateRoomPayloadWithRemovedBot(
    payload: RoomPayload,
    botId: number,
  ): RoomPayload {
    return {
      ...payload,
      generatedAt: presentationTimestamp(),
      room: {
        ...payload.room,
        bots: (payload.room.bots ?? []).filter((bot) => bot.id !== botId),
      },
    };
  }

  presentRoleEvent(roomId: number, spectator: boolean) {
    return {
      type: 'room.role',
      roomId,
      payload: {
        spectator,
        message: spectator
          ? 'Mode spectateur active.'
          : 'Mode spectateur desactive.',
      },
    };
  }

  presentRoleAnnouncement(spectator: boolean): RoomIntent {
    return {
      type: 'announcement',
      payload: {
        message: spectator ? 'Mode spectateur.' : 'Mode joueur.',
      },
    };
  }
}
