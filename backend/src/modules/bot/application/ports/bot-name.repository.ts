import type { BotNameRecord } from '../contracts/bot-name.record';

export interface CreateBotNameInput {
  name: string;
  enabled: boolean;
}

export interface BotNameRepository {
  listAll(): Promise<BotNameRecord[]>;
  listEnabled(): Promise<BotNameRecord[]>;
  findById(id: number): Promise<BotNameRecord | null>;
  findByName(name: string): Promise<BotNameRecord | null>;
  create(input: CreateBotNameInput): Promise<BotNameRecord>;
  save(record: BotNameRecord): Promise<BotNameRecord>;
  delete(id: number): Promise<void>;
  count(): Promise<number>;
}

export const BOT_NAME_REPOSITORY = Symbol('BOT_NAME_REPOSITORY');
