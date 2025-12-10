import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import {
  CatalogService,
  CatalogGame,
  CategoryNode,
  FlatCategory,
} from '../services/catalog.service';

@Controller('api/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  async all() {
    const games = await this.catalog.getAllGames();
    return {
      categories: await this.catalog.getCategoriesTree(),
      games,
    };
  }

  @Get('categories')
  async categories(): Promise<FlatCategory[]> {
    return this.catalog.getFlatCategories();
  }

  @Get('categories/:id/games')
  async categoryGames(@Param('id') rawId: string): Promise<CatalogGame[]> {
    const games = await this.catalog.getGamesForCategory(rawId);
    if (games.length === 0) {
      throw new NotFoundException();
    }
    return games;
  }

  @Get('games')
  games(): Promise<CatalogGame[]> {
    return this.catalog.getAllGames();
  }
}
