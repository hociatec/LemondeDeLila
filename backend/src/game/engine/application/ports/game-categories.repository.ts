import type { GameCategoryAssignmentRecord } from '../models/game-category-assignment.model';
import type { GameCategoryRecord } from '../models/game-category.model';

export const GAME_CATEGORIES_REPOSITORY = Symbol('GAME_CATEGORIES_REPOSITORY');

export interface GameCategoriesRepository {
  createCategory(input: {
    name: string;
    parentId: string | null;
  }): Promise<void>;
  updateCategory(
    id: string,
    data: { name?: string; parentId?: string | null },
  ): Promise<void>;
  assignCategory(gameType: string, categoryId: string | null): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  findAssignment(gameType: string): Promise<string | null | undefined>;
  listCategories(): Promise<GameCategoryRecord[]>;
  listAssignments(): Promise<GameCategoryAssignmentRecord[]>;
}
