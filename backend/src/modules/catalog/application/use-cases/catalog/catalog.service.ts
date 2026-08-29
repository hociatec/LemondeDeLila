import { Injectable } from '@nestjs/common';

import {
  CatalogGame,
  CategoryNode,
  FlatCategory,
} from '../../models/catalog-game.record';
import { CatalogCacheService } from '../../services/catalog-cache.service';
import { GetCatalogGameService } from './get-catalog-game.service';
import { ListCatalogCategoriesService } from './list-catalog-categories.service';
import { ListCatalogCategoriesTreeService } from './list-catalog-categories-tree.service';
import { ListCatalogFlatCategoriesService } from './list-catalog-flat-categories.service';
import { ListCatalogGamesForCategoryService } from './list-catalog-games-for-category.service';
import { ListCatalogGamesService } from './list-catalog-games.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly listGames: ListCatalogGamesService,
    private readonly listCategories: ListCatalogCategoriesService,
    private readonly getGameById: GetCatalogGameService,
    private readonly listTree: ListCatalogCategoriesTreeService,
    private readonly listFlatCategories: ListCatalogFlatCategoriesService,
    private readonly listGamesForCategory: ListCatalogGamesForCategoryService,
    private readonly cache: CatalogCacheService,
  ) {}

  async getAllGames(): Promise<CatalogGame[]> {
    return this.listGames.execute();
  }

  async getCategories(): Promise<string[]> {
    return this.listCategories.execute();
  }

  async getGame(id: string): Promise<CatalogGame | undefined> {
    return this.getGameById.execute(id);
  }

  async getCategoriesTree(): Promise<CategoryNode[]> {
    return this.listTree.execute();
  }

  async getFlatCategories(): Promise<FlatCategory[]> {
    return this.listFlatCategories.execute();
  }

  async getGamesForCategory(rawId: string): Promise<CatalogGame[]> {
    return this.listGamesForCategory.execute(rawId);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
