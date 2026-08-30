import type { GameCatalogOverrideRecord } from '../contracts/game-catalog-override.model';

export const GAME_CATALOG_OVERRIDES_REPOSITORY = Symbol(
  'GAME_CATALOG_OVERRIDES_REPOSITORY',
);

export interface GameCatalogOverridesRepository {
  findOne(gameType: string): Promise<GameCatalogOverrideRecord | null>;
  save(
    gameType: string,
    update: GameCatalogOverrideRecord,
  ): Promise<GameCatalogOverrideRecord>;
  delete(gameType: string): Promise<void>;
  findAll(): Promise<
    Array<{ gameType: string; override: GameCatalogOverrideRecord }>
  >;
}
