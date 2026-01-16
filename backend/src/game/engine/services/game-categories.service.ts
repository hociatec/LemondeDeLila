import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GameDefinition } from '../interfaces/game-rules-adapter.interface';
import { GameCategoryAssignmentEntity } from '../entities/game-category-assignment.entity';
import { GameCategoryEntity } from '../entities/game-category.entity';
import { GameCategoriesFsMirrorService } from './game-categories-fs-mirror.service';

export type GameCategory = {
  id: string;
  name: string;
  parentId: string | null;
  enabled: boolean;
};

type CategoriesRoot = {
  categories: GameCategory[];
  assignments: Record<string, string | null>;
};

@Injectable()
export class GameCategoriesService implements OnModuleInit {
  private readonly logger = new Logger(GameCategoriesService.name);
  private cache: CategoriesRoot | null = null;

  constructor(
    @InjectRepository(GameCategoryEntity)
    private readonly categoriesRepo: Repository<GameCategoryEntity>,
    @InjectRepository(GameCategoryAssignmentEntity)
    private readonly assignmentsRepo: Repository<GameCategoryAssignmentEntity>,
    private readonly mirror: GameCategoriesFsMirrorService,
  ) {}

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

  async assignCategory(
    gameType: string,
    categoryId: string | null,
  ): Promise<void> {
    if (!gameType || !gameType.trim()) {
      throw new Error('gameType requis');
    }
    await this.ensureLoaded();
    const root = this.getRoot();
    const normalizedCategoryId =
      typeof categoryId === 'string' ? categoryId.trim() : categoryId;
    const nextCategoryId =
      normalizedCategoryId === '' ? null : (normalizedCategoryId ?? null);

    if (nextCategoryId && !this.getCategory(nextCategoryId)) {
      throw new Error(`Catégorie inconnue : ${nextCategoryId}`);
    }

    root.assignments[gameType] = nextCategoryId;
    await this.assignmentsRepo.save({
      gameType,
      categoryId: nextCategoryId,
    });
    this.cache = root;
    await this.syncMirrorBestEffort();
  }

  async createCategory(
    name: string,
    parentId?: string | null,
  ): Promise<GameCategory> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      throw new Error('Nom de catégorie requis');
    }
    await this.ensureLoaded();
    const root = this.getRoot();
    const normalizedParentId =
      typeof parentId === 'string' ? parentId.trim() : parentId;
    const actualParentId =
      normalizedParentId === '' ? null : (normalizedParentId ?? null);

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
    await this.syncMirrorBestEffort();
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
        typeof data.parentId === 'string'
          ? data.parentId.trim()
          : data.parentId;
      const targetParentId =
        normalizedParentId === '' ? null : (normalizedParentId ?? null);

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
    await this.syncMirrorBestEffort();
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    const key = String(id ?? '').trim();
    if (!key) throw new Error('Identifiant requis');
    await this.ensureLoaded();
    const root = this.getRoot();
    const existing = root.categories.find((c) => c.id === key);
    if (!existing) {
      throw new Error(`Catégorie inconnue : ${key}`);
    }

    // Détacher les jeux affectés (null).
    await this.assignmentsRepo.update({ categoryId: key }, { categoryId: null });

    await this.categoriesRepo.delete({ id: key });
    root.categories = root.categories.filter((c) => c.id !== key);
    for (const [gameType, categoryId] of Object.entries(root.assignments)) {
      if (categoryId === key) {
        root.assignments[gameType] = null;
      }
    }
    this.cache = root;
    await this.syncMirrorBestEffort();
    await this.mirror.deleteCategory(key);
  }

  applyToDefinition(def: GameDefinition): GameDefinition {
    const assignment = this.getAssignment(def.id);
    if (assignment) {
      const assigned = this.getCategory(assignment);
      if (assigned && assigned.enabled !== false) {
        return { ...def, category: assigned.name, subcategory: undefined };
      }
    }

    // Fallback: si aucune affectation explicite n'existe, on tente de mapper automatiquement
    // la catégorie/sous-catégorie "technique" (ex: VentsInfinis) vers une catégorie admin existante.
    // Cela permet de renommer les étagères de la taverne sans devoir affecter chaque jeu manuellement.
    const inferred = this.inferCategoryFromDefinition(def);
    if (!inferred) {
      return def;
    }

    return { ...def, category: inferred.name, subcategory: undefined };
  }

  private inferCategoryFromDefinition(
    def: GameDefinition,
  ): GameCategory | undefined {
    const raw = (def.subcategory || def.category || '').trim();
    if (!raw) {
      return undefined;
    }

    const root = this.getRoot();
    const normalizedId = this.slugify(this.normalizeLabel(raw));
    if (!normalizedId) {
      return undefined;
    }

    // Alias: certains jeux historiques utilisent des libellés "marketing" qui ne correspondent
    // pas aux ids techniques des catégories DB. On mappe ici pour éviter des doublons d'étagères.
    const aliasToCategoryId: Record<string, string> = {
      // "Les Vents Sacrés" est la même étagère que `galopant` dans la DB.
      'les-vents-sacres': 'galopant',
      'vents-sacres': 'galopant',
      'vent-sacres': 'galopant',
      'vents-sacre': 'galopant',
    };
    const targetId = aliasToCategoryId[normalizedId] ?? normalizedId;

    // 1) Match exact sur l'id (recommandé).
    const direct = root.categories.find(
      (c) => c.enabled !== false && c.id === targetId,
    );
    if (direct) {
      return direct;
    }

    // 2) Match suffixe (ex: les-vents-infinis -> vents-infinis).
    const suffix = `-${targetId}`;
    const matches = root.categories.filter(
      (c) => c.enabled !== false && c.id.endsWith(suffix),
    );
    return matches.length === 1 ? matches[0] : undefined;
  }

  private normalizeLabel(value: string): string {
    return (value ?? '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim();
  }

  private getRoot(): CategoriesRoot {
    return this.cache ?? { categories: [], assignments: {} };
  }

  private async ensureLoaded(): Promise<void> {
    if (this.cache) return;

    try {
      const categoriesRows = await this.categoriesRepo.find();
      const assignmentsRows = await this.assignmentsRepo.find();

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
      await this.syncMirrorBestEffort();
    } catch (error) {
      this.logger.warn(
        `Impossible de charger les catégories: ${(error as Error).message}`,
      );
      this.cache = { categories: [], assignments: {} };
    }
  }

  private async syncMirrorBestEffort(): Promise<void> {
    try {
      const root = this.getRoot();
      await this.mirror.syncAll({
        categories: root.categories,
        assignments: root.assignments,
      });
    } catch (err) {
      this.logger.debug(
        `Sync miroir ignorée: ${(err as Error).message}`,
        err as Error,
      );
    }
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
