import { Injectable } from '@nestjs/common';

import { CatalogGame } from '../../contracts/catalog-game.record';
import { CatalogMapperService } from '../../services/catalog-mapper.service';
import { ListCatalogGamesService } from './list-catalog-games.service';

@Injectable()
export class ListCatalogGamesForCategoryService {
  constructor(
    private readonly listGames: ListCatalogGamesService,
    private readonly mapper: CatalogMapperService,
  ) {}

  async execute(rawId: string): Promise<CatalogGame[]> {
    const target = this.mapper.normalizeCategoryId(rawId);
    if (!target) {
      return [];
    }

    const games = await this.listGames.execute();
    return games.filter((game) => this.mapper.matchesCategory(game, target));
  }
}
