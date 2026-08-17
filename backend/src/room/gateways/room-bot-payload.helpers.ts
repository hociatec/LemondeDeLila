import type { RoomPayload } from '../dto/room-response.dto';

export function addBotToRoomPayload(
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

export function removeBotFromRoomPayload(
  payload: RoomPayload,
  botId: number,
): RoomPayload {
  payload.room.bots = (payload.room.bots ?? []).filter(
    (bot) => bot.id !== botId,
  );
  payload.generatedAt = new Date().toISOString();
  return payload;
}
