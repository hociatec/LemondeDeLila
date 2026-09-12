import type { BotRoomRecord } from '../read-models/bot-room.record';

/** Read-only room capabilities needed by bot queries. */
export interface BotRoomReader {
  findLastBotForRoom(roomId: number): Promise<BotRoomRecord | null>;
  countBotsForRoom(roomId: number): Promise<number>;
}

export const BOT_ROOM_READER = Symbol('BOT_ROOM_READER');
