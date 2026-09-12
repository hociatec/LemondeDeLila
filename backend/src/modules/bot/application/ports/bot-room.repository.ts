import type {
  BotMutationRequest,
  BotMutationDecision,
} from '../models/bot-mutation.model';
import type { BotRoomRecord } from '../read-models/bot-room.record';
import type { BotRoomReader } from './bot-room-reader.port';

export interface CreateBotForRoomInput {
  roomId: number;
  name: string;
}

export interface BotRoomRepository extends BotRoomReader {
  runRoomMutation<T>(
    roomId: number,
    operation: (rooms: BotRoomRepository) => Promise<T>,
  ): Promise<T>;
  assessBotMutation(
    roomId: number,
    request: BotMutationRequest,
  ): Promise<BotMutationDecision>;
  listBotsForRoom(roomId: number): Promise<BotRoomRecord[]>;
  createBot(input: CreateBotForRoomInput): Promise<BotRoomRecord>;
  findBotById(roomId: number, botId: number): Promise<BotRoomRecord | null>;
  renameBot(botId: number, name: string): Promise<void>;
  deleteBot(botId: number): Promise<void>;
  deleteAllBotsForRoom(roomId: number): Promise<void>;
}

export const BOT_ROOM_REPOSITORY = Symbol('BOT_ROOM_REPOSITORY');
