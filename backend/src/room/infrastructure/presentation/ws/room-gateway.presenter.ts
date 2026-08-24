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
    payload.room.bots = payload.room.bots ?? [];
    if (!payload.room.bots.some((candidate) => candidate.id === bot.id)) {
      payload.room.bots.push({ id: bot.id, name: bot.name });
    }
    payload.generatedAt = new Date().toISOString();
    return payload;
  }

  updateRoomPayloadWithRemovedBot(
    payload: RoomPayload,
    botId: number,
  ): RoomPayload {
    payload.room.bots = (payload.room.bots ?? []).filter(
      (bot) => bot.id !== botId,
    );
    payload.generatedAt = new Date().toISOString();
    return payload;
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
