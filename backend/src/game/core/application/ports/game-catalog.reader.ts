import type { GameCatalogEntryRecord } from '../models/game-catalog-entry.model';

export type LoadGameJsonFileParams = {
  baseDir: string;
  filename: string;
  contentDir?: string;
};

export interface GameCatalogReader {
  listEntries(): GameCatalogEntryRecord[];
  loadJsonFile<T>(params: LoadGameJsonFileParams): T;
  readTextFile(path: string): string;
}

export const GAME_CATALOG_READER = Symbol('GAME_CATALOG_READER');
