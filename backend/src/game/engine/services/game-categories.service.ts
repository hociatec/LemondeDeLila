import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { GameDefinition } from '../interfaces/game-rules-adapter.interface';

export type GameCategory = {
  id: string;
  name: string;
  parentId: string | null;
  enabled: boolean;
};

type CategoriesFile = {
  categories: GameCategory[];
  assignments: Record<string, string | null>;
};

@Injectable()
export class GameCategoriesService {
  private readonly logger = new Logger(GameCategoriesService.name);
  private readonly filePath: string;
  private cache: CategoriesFile | null = null;

  constructor() {
    const cwd = process.cwd();
    this.filePath = path.resolve(cwd, 'data', 'game-categories.json');
  }

  getCategories(): GameCategory[] {
    return [...this.getRoot().categories];
  }

  getCategory(id: string): GameCategory | undefined {
    if (!id) return undefined;
    return this.getRoot().categories.find((category) => category.id === id);
  }

  getAssignment(gameType: string): string | null {
    if (!gameType) return null;
    return this.getRoot().assignments[gameType] ?? null;
  }

  listAssignments(): Record<string, string | null> {
    return { ...this.getRoot().assignments };
  }

  async assignCategory(gameType: string, categoryId: string | null): Promise<void> {
    if (!gameType || !gameType.trim()) {
      throw new Error('gameType requis');
    }
    const root = this.getRoot();
    const normalizedCategoryId = typeof categoryId === 'string' ? categoryId.trim() : categoryId;
    if (normalizedCategoryId === '') {
      categoryId = null;
    } else {
      categoryId = normalizedCategoryId;
    }
    if (categoryId && !this.getCategory(categoryId)) {
      throw new Error(`Catégorie inconnue : ${categoryId}`);
    }
    root.assignments[gameType] = categoryId ?? null;
    await this.save(root);
    this.cache = root;
  }

  async createCategory(name: string, parentId?: string | null): Promise<GameCategory> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      throw new Error('Nom de catégorie requis');
    }
    const root = this.getRoot();
    const normalizedParentId =
      typeof parentId === 'string' ? parentId.trim() : parentId;
    const actualParentId =
      normalizedParentId === '' ? null : normalizedParentId ?? null;
    if (actualParentId && !this.getCategory(actualParentId)) {
      throw new Error(`Catégorie parente introuvable : ${actualParentId}`);
    }
    const slug = this.ensureUniqueId(trimmed, root.categories);
    const category: GameCategory = {
      id: slug,
      name: trimmed,
      parentId: actualParentId,
      enabled: true,
    };
    root.categories.push(category);
    await this.save(root);
    this.cache = root;
    return category;
  }

  async updateCategory(
    id: string,
    data: { name?: string; parentId?: string | null },
  ): Promise<GameCategory> {
    if (!id || !id.trim()) {
      throw new Error('Identifiant requis');
    }
    const root = this.getRoot();
    const category = root.categories.find((item) => item.id === id);
    if (!category) {
      throw new Error(`Catégorie inconnue : ${id}`);
    }
    if (data.name !== undefined) {
      const trimmed = data.name?.trim() ?? '';
      if (!trimmed) {
        throw new Error('Nom de catégorie requis');
      }
      category.name = trimmed;
    }
    if (data.parentId !== undefined) {
      const normalizedParentId =
        typeof data.parentId === 'string' ? data.parentId.trim() : data.parentId;
      const targetParentId =
        normalizedParentId === '' ? null : normalizedParentId ?? null;
      if (targetParentId && !this.getCategory(targetParentId)) {
        throw new Error(`Catégorie parente introuvable : ${targetParentId}`);
      }
      if (targetParentId === category.id) {
        throw new Error('Une catégorie ne peut pas être sa propre parente.');
      }
      category.parentId = targetParentId;
    }
    await this.save(root);
    this.cache = root;
    return category;
  }

  applyToDefinition(def: GameDefinition): GameDefinition {
    const assignment = this.getAssignment(def.id);
    if (!assignment) {
      return def;
    }
    const category = this.getCategory(assignment);
    if (!category) {
      return def;
    }
    return {
      ...def,
      category: category.name,
      subcategory: undefined,
    };
  }

  private getRoot(): CategoriesFile {
    if (this.cache) {
      return this.cache;
    }
    const loaded = this.tryLoad();
    this.cache = loaded;
    return loaded;
  }

  private tryLoad(): CategoriesFile {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { categories: [], assignments: {} };
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as CategoriesFile;
      if (!parsed || typeof parsed !== 'object') {
        return { categories: [], assignments: {} };
      }
      const categories = Array.isArray(parsed.categories)
        ? parsed.categories.map((category) => ({
            ...category,
            enabled: typeof category.enabled === 'boolean' ? category.enabled : true,
          }))
        : [];
      const assignments =
        parsed.assignments && typeof parsed.assignments === 'object'
          ? parsed.assignments
          : {};
      return { categories, assignments };
    } catch (error) {
      this.logger.warn(`Impossible de charger les catégories (${this.filePath}): ${(error as Error).message}`);
      return { categories: [], assignments: {} };
    }
  }

  private async save(root: CategoriesFile): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(this.filePath, JSON.stringify(root, null, 2), 'utf-8');
  }

  private ensureUniqueId(name: string, existing: GameCategory[]): string {
    const base = this.slugify(name);
    if (!base) {
      throw new Error('Nom invalide');
    }
    let candidate = base;
    let attempt = 1;
    while (existing.some((category) => category.id === candidate)) {
      candidate = `${base}-${attempt++}`;
    }
    return candidate;
  }

  private slugify(value: string): string {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
}
