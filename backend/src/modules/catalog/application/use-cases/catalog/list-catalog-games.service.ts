import { Inject, Injectable } from '@nestjs/common';

import { CatalogGame } from '../../contracts/catalog-game.record';
import { CATALOG_GAME_SOURCE_PORT } from '../../ports/catalog-game-source.port';
import type { CatalogGameSourcePort } from '../../ports/catalog-game-source.port';
import { CatalogCacheService } from '../../services/catalog-cache.service';
import { CatalogMapperService } from '../../services/catalog-mapper.service';

@Injectable()
export class ListCatalogGamesService {
  constructor(
    @Inject(CATALOG_GAME_SOURCE_PORT)
    private readonly source: CatalogGameSourcePort,
    private readonly cache: CatalogCacheService,
    private readonly mapper: CatalogMapperService,
  ) {}

  async execute(): Promise<CatalogGame[]> {
    const cached = this.cache.getGames();
    if (cached) {
      return cached;
    }

    const definitions = await this.source.listGames();
    const games = this.mapper.toCatalogGames(definitions);
    return this.cache.setGames(games);
  }
}
