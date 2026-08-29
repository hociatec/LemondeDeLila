import { CatalogService } from '../application/use-cases/catalog/catalog.service';
import { GetCatalogGameService } from '../application/use-cases/catalog/get-catalog-game.service';
import { ListCatalogCategoriesService } from '../application/use-cases/catalog/list-catalog-categories.service';
import { ListCatalogCategoriesTreeService } from '../application/use-cases/catalog/list-catalog-categories-tree.service';
import { ListCatalogFlatCategoriesService } from '../application/use-cases/catalog/list-catalog-flat-categories.service';
import { ListCatalogGamesForCategoryService } from '../application/use-cases/catalog/list-catalog-games-for-category.service';
import { ListCatalogGamesService } from '../application/use-cases/catalog/list-catalog-games.service';

export const CATALOG_USE_CASE_PROVIDERS = [
  ListCatalogGamesService,
  GetCatalogGameService,
  ListCatalogCategoriesService,
  ListCatalogCategoriesTreeService,
  ListCatalogFlatCategoriesService,
  ListCatalogGamesForCategoryService,
  CatalogService,
];
