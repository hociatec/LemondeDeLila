import type {
  BotManagedRoomRecord,
  BotRoomRecord,
} from '../contracts/bot-room.record';

export interface CreateBotForRoomInput {
  roomId: number;
  name: string;
}

export interface BotRoomRepository {
  runRoomMutation<T>(
    roomId: number,
    operation: (rooms: BotRoomRepository) => Promise<T>,
  ): Promise<T>;
  findRoomById(roomId: number): Promise<BotManagedRoomRecord | null>;
  listBotsForRoom(roomId: number): Promise<BotRoomRecord[]>;
  createBot(input: CreateBotForRoomInput): Promise<BotRoomRecord>;
  findBotById(roomId: number, botId: number): Promise<BotRoomRecord | null>;
  findLastBotForRoom(roomId: number): Promise<BotRoomRecord | null>;
  renameBot(botId: number, name: string): Promise<void>;
  deleteBot(botId: number): Promise<void>;
  deleteAllBotsForRoom(roomId: number): Promise<void>;
  countBotsForRoom(roomId: number): Promise<number>;
  countActiveHumansForRoom(roomId: number): Promise<number>;
}

export const BOT_ROOM_REPOSITORY = Symbol('BOT_ROOM_REPOSITORY');
