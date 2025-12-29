import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import type { GameDefinition } from '../interfaces/game-rules-adapter.interface';
import { GameCategoryAssignmentEntity } from '../entities/game-category-assignment.entity';
import { GameCategoryEntity } from '../entities/game-category.entity';

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
export class GameCategoriesService implements OnModuleInit {
  private readonly logger = new Logger(GameCategoriesService.name);
  private readonly filePath: string;
  private cache: CategoriesFile | null = null;

  constructor(
    @InjectRepository(GameCategoryEntity)
    private readonly categoriesRepo: Repository<GameCategoryEntity>,
    @InjectRepository(GameCategoryAssignmentEntity)
    private readonly assignmentsRepo: Repository<GameCategoryAssignmentEntity>,
  ) {
    const cwd = process.cwd();
    this.filePath = path.resolve(cwd, 'data', 'game-categories.json');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureLoaded();
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
    await this.ensureLoaded();
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
    await this.assignmentsRepo.save({
      gameType,
      categoryId: categoryId ?? null,
    });
    this.cache = root;
  }

  async createCategory(name: string, parentId?: string | null): Promise<GameCategory> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      throw new Error('Nom de catégorie requis');
    }
    await this.ensureLoaded();
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
    await this.categoriesRepo.insert({
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      enabled: category.enabled,
    });
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
    await this.ensureLoaded();
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
    await this.categoriesRepo.update(
      { id },
      { name: category.name, parentId: category.parentId },
    );
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
    return { categories: [], assignments: {} };
  }

  private tryLoadFromJson(): CategoriesFile {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { categories: [], assignments: {} };
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as CategoriesFile;
      if (!parsed || typeof parsed !== 'object') {
        return { categories: [], assignments: {} };
      }

      const normalized = this.normalizeRoot({
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        assignments:
          parsed.assignments && typeof parsed.assignments === 'object'
            ? (parsed.assignments as Record<string, string | null>)
            : {},
      });

      return normalized.root;
    } catch (error) {
      this.logger.warn(`Impossible de charger les catégories (${this.filePath}): ${(error as Error).message}`);
      return { categories: [], assignments: {} };
    }
  }

  private normalizeRoot(raw: CategoriesFile): { root: CategoriesFile; changed: boolean } {
    let changed = false;

    const byId = new Map<string, GameCategory>();
    const order: string[] = [];

    for (const entry of raw.categories ?? []) {
      const id = typeof (entry as any)?.id === 'string' ? (entry as any).id.trim() : '';
      const name = typeof (entry as any)?.name === 'string' ? (entry as any).name.trim() : '';
      if (!id || !name) {
        changed = true;
        continue;
      }
      const key = id.toLowerCase();
      const parentIdRaw = (entry as any).parentId;
      const parentId =
        typeof parentIdRaw === 'string' ? parentIdRaw.trim() || null : null;
      const enabledRaw = (entry as any).enabled;
      const enabled = typeof enabledRaw === 'boolean' ? enabledRaw : true;
      if (typeof enabledRaw !== 'boolean') {
        changed = true;
      }

      const next: GameCategory = { id, name, parentId, enabled };
      if (!byId.has(key)) {
        byId.set(key, next);
        order.push(key);
      } else {
        // Doublon d'id : on garde l'existant, mais on complète s'il manque des infos.
        changed = true;
        const current = byId.get(key) as GameCategory;
        if (!current.name && next.name) current.name = next.name;
        if (current.parentId == null && next.parentId != null) current.parentId = next.parentId;
        if (current.enabled !== false && next.enabled === false) current.enabled = false;
      }
    }

    // Nettoyage parentId invalides (références absentes / auto-référence)
    for (const key of order) {
      const category = byId.get(key) as GameCategory;
      if (!category.parentId) continue;
      const parentKey = category.parentId.toLowerCase();
      if (parentKey === key || !byId.has(parentKey)) {
        category.parentId = null;
        changed = true;
      }
    }

    const categories = order.map((key) => byId.get(key) as GameCategory);

    const assignments: Record<string, string | null> = {};
    for (const [gameType, rawCategoryId] of Object.entries(raw.assignments ?? {})) {
      const normalizedGameType = (gameType ?? '').trim();
      if (!normalizedGameType) {
        changed = true;
        continue;
      }
      const normalizedCategoryId =
        typeof rawCategoryId === 'string' ? rawCategoryId.trim() : null;
      if (!normalizedCategoryId) {
        assignments[normalizedGameType] = null;
        if (rawCategoryId !== null) changed = true;
        continue;
      }
      if (!byId.has(normalizedCategoryId.toLowerCase())) {
        assignments[normalizedGameType] = null;
        changed = true;
        continue;
      }
      assignments[normalizedGameType] = normalizedCategoryId;
      if (normalizedGameType !== gameType || normalizedCategoryId !== rawCategoryId) {
        changed = true;
      }
    }

    return { root: { categories, assignments }, changed };
  }

  private async ensureLoaded(): Promise<void> {
    if (this.cache) return;

    const categoriesRows = await this.categoriesRepo.find();
    const assignmentsRows = await this.assignmentsRepo.find();

    if (categoriesRows.length === 0 && assignmentsRows.length === 0) {
      const imported = this.tryLoadFromJson();
      this.cache = imported;
      await this.importToDb(imported);
      return;
    }

    const categories: GameCategory[] = categoriesRows.map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parentId ?? null,
      enabled: row.enabled !== false,
    }));
    const assignments: Record<string, string | null> = {};
    for (const row of assignmentsRows) {
      assignments[row.gameType] = row.categoryId ?? null;
    }
    this.cache = { categories, assignments };
  }

  private async importToDb(root: CategoriesFile): Promise<void> {
    const categories = root.categories ?? [];
    const assignments = root.assignments ?? {};

    const known = new Set<string>();
    await this.categoriesRepo.save(
      categories
        .filter((c) => c?.id && c?.name)
        .map((c) => {
          known.add(c.id);
          return {
            id: c.id,
            name: c.name,
            parentId: c.parentId ?? null,
            enabled: c.enabled !== false,
          };
        }),
    );

    await this.assignmentsRepo.save(
      Object.entries(assignments)
        .map(([gameType, categoryId]) => ({
          gameType,
          categoryId: categoryId && known.has(categoryId) ? categoryId : null,
        }))
        .filter((row) => row.gameType),
    );
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
