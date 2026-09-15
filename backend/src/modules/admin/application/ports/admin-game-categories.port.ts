export interface AdminGameCategoriesPort {
  createCategory(name: string, parentId: string | null): Promise<void>;
  updateCategory(
    id: string,
    data: { name?: string; parentId?: string | null },
  ): Promise<void>;
  assignCategory(gameType: string, categoryId: string | null): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  getAssignment(gameType: string): Promise<string | null | undefined>;
  getCategories(): Promise<
    Array<{ id: string; name: string; parentId: string | null }>
  >;
  listAssignments(): Promise<
    Array<{ gameType: string; categoryId: string | null }>
  >;
}

export const ADMIN_GAME_CATEGORIES_PORT = Symbol('ADMIN_GAME_CATEGORIES_PORT');
