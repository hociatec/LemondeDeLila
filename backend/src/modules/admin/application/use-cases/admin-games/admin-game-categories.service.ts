import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
    await this.categories.createCategory(
      normalizeCategoryName(name),
      normalizeCategoryId(parentId),
    );
  }

  async update(id: string, data: { name?: string; parentId?: string | null }) {
    await this.categories.updateCategory(id, {
      name:
        data.name === undefined ? undefined : normalizeCategoryName(data.name),
      parentId: normalizeCategoryId(data.parentId),
    });
  }

  async assign(gameType: string, categoryId?: string | null) {
    await this.categories.assignCategory(
      normalizeGameType(gameType),
      normalizeCategoryId(categoryId),
    );
  }

  async delete(id: string) {
    const normalized = normalizeCategoryId(id);
    if (!normalized) {
      throw new BadRequestException('Identifiant de catégorie requis.');
    }
    await this.categories.deleteCategory(normalized);
  }
}

function normalizeCategoryName(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 200) {
    throw new BadRequestException('Nom de catégorie invalide.');
  }
  return normalized;
}

function normalizeCategoryId(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    throw new BadRequestException('Identifiant de catégorie invalide.');
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 120) {
    throw new BadRequestException('Identifiant de catégorie invalide.');
  }
  return normalized;
}

function normalizeGameType(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 100) {
    throw new BadRequestException('Type de jeu invalide.');
  }
  return normalized;
}
