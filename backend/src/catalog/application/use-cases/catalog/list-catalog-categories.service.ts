import { Injectable } from '@nestjs/common';

import { CatalogMapperService } from '../../services/catalog-mapper.service';
import { ListCatalogGamesService } from './list-catalog-games.service';

@Injectable()
export class ListCatalogCategoriesService {
  constructor(
    private readonly listGames: ListCatalogGamesService,
    private readonly mapper: CatalogMapperService,
  ) {}

  async execute(): Promise<string[]> {
    const games = await this.listGames.execute();
    return this.mapper.listCategoryNames(games);
  }
}
