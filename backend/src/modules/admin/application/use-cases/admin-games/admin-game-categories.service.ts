import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_GAME_CATEGORIES_PORT,
  type AdminGameCategoriesPort,
} from '../../ports/admin-game-categories.port';

@Injectable()
export class AdminGameCategoriesService {
  constructor(
    @Inject(ADMIN_GAME_CATEGORIES_PORT)
    private readonly categories: AdminGameCategoriesPort,
  ) {}

  async create(name: string, parentId?: string | null) {
    await this.categories.createCategory(name, parentId ?? null);
  }

  async update(id: string, data: { name?: string; parentId?: string | null }) {
    await this.categories.updateCategory(id, {
      name: data.name,
      parentId: data.parentId ?? null,
    });
  }

  async assign(gameType: string, categoryId?: string | null) {
    await this.categories.assignCategory(gameType, categoryId ?? null);
  }

  async delete(id: string) {
    await this.categories.deleteCategory(id);
  }
}
