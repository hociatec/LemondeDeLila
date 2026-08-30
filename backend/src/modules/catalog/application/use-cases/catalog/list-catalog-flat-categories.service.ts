import { Injectable } from '@nestjs/common';

import { FlatCategory } from '../../contracts/catalog-game.record';
import { CatalogMapperService } from '../../services/catalog-mapper.service';
import { ListCatalogGamesService } from './list-catalog-games.service';

@Injectable()
export class ListCatalogFlatCategoriesService {
  constructor(
    private readonly listGames: ListCatalogGamesService,
    private readonly mapper: CatalogMapperService,
  ) {}

  async execute(): Promise<FlatCategory[]> {
    const games = await this.listGames.execute();
    return this.mapper.buildFlatCategories(games);
  }
}
