import { CatalogSourceGame } from '../models/catalog-source-game.record';

export interface CatalogGameSourcePort {
  listGames(): Promise<CatalogSourceGame[]>;
}

export const CATALOG_GAME_SOURCE_PORT = Symbol('CATALOG_GAME_SOURCE_PORT');
