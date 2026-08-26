import type { GameCatalogEntryRecord } from '../models/game-catalog-entry.model';

export interface GameCatalogReader {
  listEntries(): GameCatalogEntryRecord[];
  readTextFile(path: string): string;
}

export const GAME_CATALOG_READER = Symbol('GAME_CATALOG_READER');
