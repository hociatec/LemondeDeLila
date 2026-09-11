import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { GameCategoryAssignmentRecord } from '../models/game-category-assignment.model';
import type { GameCategoryRecord } from '../models/game-category.model';
import {
  GAME_CATEGORIES_REPOSITORY,
  type GameCategoriesRepository,
} from '../ports/game-categories.repository';

@Injectable()
export class GameCategoriesService {
  constructor(
    @Inject(GAME_CATEGORIES_REPOSITORY)
    private readonly categories: GameCategoriesRepository,
  ) {}

  async createCategory(name: string, parentId: string | null): Promise<void> {
    await this.categories.createCategory({
      name,
      parentId: parentId ?? null,
    });
  }

  async updateCategory(
    id: string,
    data: { name?: string; parentId?: string | null },
  ): Promise<void> {
    await this.categories.updateCategory(id, data);
  }

  async assignCategory(
    gameType: string,
    categoryId: string | null,
  ): Promise<void> {
    await this.categories.assignCategory(gameType, categoryId);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.categories.deleteCategory(id);
  }

  getAssignment(gameType: string): Promise<string | null | undefined> {
    return this.categories.findAssignment(gameType);
  }

  getCategories(): Promise<GameCategoryRecord[]> {
    return this.categories.listCategories();
  }

  listAssignments(): Promise<GameCategoryAssignmentRecord[]> {
    return this.categories.listAssignments();
  }
}
