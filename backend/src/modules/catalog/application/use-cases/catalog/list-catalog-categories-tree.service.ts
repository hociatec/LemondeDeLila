import { Injectable } from '@nestjs/common';

import { CategoryNode } from '../../models/catalog-game.record';
import { CatalogMapperService } from '../../services/catalog-mapper.service';
import { ListCatalogGamesService } from './list-catalog-games.service';

@Injectable()
export class ListCatalogCategoriesTreeService {
  constructor(
    private readonly listGames: ListCatalogGamesService,
    private readonly mapper: CatalogMapperService,
  ) {}

  async execute(): Promise<CategoryNode[]> {
    const games = await this.listGames.execute();
    return this.mapper.buildCategoryTree(games);
  }
}
