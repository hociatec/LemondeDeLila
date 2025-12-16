import { Injectable } from '@nestjs/common';
import { CatalogService } from '../services/catalog.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { CatalogCategoryDto } from './ws.dto';

@Injectable()
export class CatalogWsHandler {
  constructor(
    private readonly catalog: CatalogService,
    private readonly validator: PayloadValidationService,
  ) {}

  async all() {
    const categories = await this.catalog.getCategoriesTree();
    const games = await this.catalog.getAllGames();
    return { type: 'catalog.all', payload: { categories, games } };
  }

  async categories() {
    const categories = await this.catalog.getFlatCategories();
    return { type: 'catalog.categories', payload: categories };
  }

  async categoryGames(payload: any) {
    const dto = this.validator.validate(CatalogCategoryDto, payload);
    const games = await this.catalog.getGamesForCategory(dto.id);
    return { type: 'catalog.categoryGames', payload: games };
  }

  async games() {
    const games = await this.catalog.getAllGames();
    return { type: 'catalog.games', payload: games };
  }
}

