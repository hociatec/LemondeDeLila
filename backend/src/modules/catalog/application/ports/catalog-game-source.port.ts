import { CatalogSourceGame } from '../read-models/catalog-source-game.record';

export interface CatalogGameSourcePort {
  listGames(): Promise<CatalogSourceGame[]>;
}

export const CATALOG_GAME_SOURCE_PORT = Symbol('CATALOG_GAME_SOURCE_PORT');
