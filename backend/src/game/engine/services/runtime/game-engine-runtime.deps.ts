import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../../interfaces/game-rules-adapter.interface';

export type RuntimeBroadcaster = (
  gameType: string,
  roomId: number,
  state: GameStateEntity,
) => void;

export type RuntimeStoreSet = (
  roomId: number,
  gameType: string,
  state: GameStateEntity,
  opts?: { asyncPersist?: boolean },
) => Promise<void>;

export type RuntimeStoreGet = (
  roomId: number,
  gameType: string,
) => Promise<GameStateEntity | null>;

export type RuntimeLogger = {
  debug: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;
  logPlayerAction?: (...args: any[]) => void;
};

export type RuntimeMetadataDeps = {
  toMetadata: (target: { metadata?: unknown }) => Record<string, unknown>;
  normalizeMetadataString: (value: unknown) => string;
  parseMetadataNumber: (value: unknown) => number | null;
  getMetadataObject?: (
    metadata: Record<string, unknown>,
    key: string,
  ) => Record<string, unknown> | null;
};

export type RuntimeBotActorDeps = {
  registryGetHandler: (gameType: string) => GameRulesAdapter | null;
  getBotActorIdForState: (
    state: GameStateEntity,
    handler: GameRulesAdapter | null,
  ) => number | null;
};
