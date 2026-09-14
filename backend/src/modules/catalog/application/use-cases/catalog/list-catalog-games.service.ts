import { Inject, Injectable } from '@nestjs/common';

import { CatalogGame } from '../../read-models/catalog-game.record';
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

  async execute(
    options: { fresh?: boolean; includeDisabled?: boolean } = {},
  ): Promise<CatalogGame[]> {
    if (options.fresh !== true && options.includeDisabled !== true) {
      const cached = this.cache.getGames();
      if (cached) {
        return cached;
      }
    }

    const revision = this.cache.revision();
    const definitions = await this.source.listGames({
      includeDisabled: options.includeDisabled === true,
    });
    const games = this.mapper.toCatalogGames(definitions);
    if (options.includeDisabled === true) return games;
    return this.cache.setGames(games, revision);
  }
}
