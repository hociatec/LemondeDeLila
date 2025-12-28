import { Injectable } from '@nestjs/common';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';

export type CatalogGame = {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  summary: string;
  engine: string;
  category: string;
  subcategory: string;
  categories: string[];
  manifestPath?: string;
  rulesPath?: string;
};

export type CategoryNode = {
  id: string;
  name: string;
  children: CategoryNode[];
};
export type FlatCategory = {
  id: string;
  name: string;
  parentId: string | null;
};

@Injectable()
export class CatalogService {
  private cachedGames: CatalogGame[] | null = null;
  private cacheExpiresAt = 0;
  private readonly cacheTtlMs: number;

  constructor(private readonly registry: GameRegistryService) {
    const ttlCandidate = Number(process.env.GAME_CATALOG_CACHE_TTL_MS ?? 30000);
    this.cacheTtlMs =
      Number.isFinite(ttlCandidate) && ttlCandidate >= 0 ? ttlCandidate : 30000;
  }

  async getAllGames(): Promise<CatalogGame[]> {
    if (
      this.cachedGames &&
      (this.cacheTtlMs === 0 || Date.now() < this.cacheExpiresAt)
    ) {
      return this.cachedGames;
    }
    const games = await this.loadFromRegistry();
    this.cachedGames = games.filter((game) => !!game.id);
    this.cacheExpiresAt =
      this.cacheTtlMs === 0
        ? Number.MAX_SAFE_INTEGER
        : Date.now() + this.cacheTtlMs;
    return this.cachedGames;
  }

  async getCategories(): Promise<string[]> {
    const games = await this.getAllGames();
    const categories = new Set<string>();
    games.forEach((game) => categories.add(game.category));
    return Array.from(categories);
  }

  async getGame(id: string): Promise<CatalogGame | undefined> {
    const games = await this.getAllGames();
    return games.find((game) => game.id === id);
  }

  async getCategoriesTree(): Promise<CategoryNode[]> {
    const games = await this.getAllGames();
    return this.buildTreeFromGames(games);
  }

  async getFlatCategories(): Promise<FlatCategory[]> {
    const games = await this.getAllGames();
    return this.listCategories(games);
  }

  async getGamesForCategory(rawId: string): Promise<CatalogGame[]> {
    const target = this.normalizeCategoryId(rawId);
    if (!target) {
      return [];
    }
    return (await this.getAllGames()).filter((game) =>
      this.gameMatchesCategory(game, target),
    );
  }

  async clearCache(): Promise<void> {
    this.cachedGames = null;
    this.cacheExpiresAt = 0;
  }

  private async loadFromRegistry(): Promise<CatalogGame[]> {
    const definitions = await this.registry.listGames();
    return definitions.map((def) => {
      // UX catalogue:
      // On préfère afficher directement les sous-catégories (ex: "Les Quatre Vents")
      // plutôt que des catégories techniques ("JeuxDePlateaux", "JeuxDeCartes").
      //
      // Règle:
      // - si une sous-catégorie existe, elle devient la catégorie affichée (1 seul niveau)
      // - sinon on garde la catégorie.
      const rawCategory = this.formatCategoryName(def.category || 'Catalogue');
      const rawSubcategory = this.formatCategoryName(def.subcategory || '');

      const category = rawSubcategory || rawCategory;
      const subcategory = '';
      const categories = this.buildCategoryRefs(category, subcategory);
      return {
        id: def.id,
        name: def.name,
        minPlayers: def.minPlayers ?? 2,
        maxPlayers: def.maxPlayers ?? 6,
        summary: def.description ?? '',
        engine: def.id,
        category,
        subcategory,
        categories,
      };
    });
  }

  private formatCategoryName(name: string): string {
    if (!name) return '';
    // Convertit PascalCase en mots séparés puis capitalise.
    const spaced = name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ');
    return spaced
      .split(' ')
      .filter(Boolean)
      .map(
        (segment) =>
          segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
      )
      .join(' ');
  }

  private slugify(value: string): string {
    // supprime les accents pour limiter les collisions
    const noAccent = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return noAccent.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  private buildCategoryRefs(
    categoryName: string,
    subcategoryName: string,
  ): string[] {
    const refs: string[] = [];
    const categorySlug = this.slugify(categoryName);
    if (categorySlug) {
      refs.push(categorySlug);
    }
    const subSlug = this.slugify(subcategoryName);
    if (subSlug) {
      refs.push(categorySlug ? `${categorySlug}/${subSlug}` : subSlug);
    }
    return refs;
  }

  private buildTreeFromGames(games: CatalogGame[]): CategoryNode[] {
    const categories: Record<
      string,
      { id: string; name: string; childrenMap: Record<string, CategoryNode> }
    > = {};

    for (const game of games) {
      const categoryName = game.category || 'Catalogue';
      const subcategoryName = game.subcategory || '';
      const categoryId = this.slugify(categoryName);

      if (!categories[categoryId]) {
        categories[categoryId] = {
          id: categoryId,
          name: categoryName,
          childrenMap: {},
        };
      }

      if (subcategoryName) {
        const subSlug = this.slugify(subcategoryName);
        const subId = `${categoryId}/${subSlug}`;
        if (!categories[categoryId].childrenMap[subId]) {
          categories[categoryId].childrenMap[subId] = {
            id: subId,
            name: subcategoryName,
            children: [],
          };
        }
      }
    }

    return Object.values(categories).map((node) => {
      const children = Object.values(node.childrenMap).map((child) => ({
        id: child.id,
        name: child.name,
        children: [],
      }));
      return { id: node.id, name: node.name, children };
    });
  }

  private listCategories(games: CatalogGame[]): FlatCategory[] {
    const categories: Record<string, FlatCategory> = {};

    for (const game of games) {
      const categoryName = game.category || 'Catalogue';
      const categoryId = this.slugify(categoryName);
      if (!categories[categoryId]) {
        categories[categoryId] = {
          id: categoryId,
          name: categoryName,
          parentId: null,
        };
      }

      const subcategoryName = game.subcategory || '';
      if (subcategoryName) {
        const subSlug = this.slugify(subcategoryName);
        const subId = `${categoryId}/${subSlug}`;
        if (!categories[subId]) {
          categories[subId] = {
            id: subId,
            name: subcategoryName,
            parentId: categoryId,
          };
        }
      }
    }

    return Object.values(categories);
  }

  private gameMatchesCategory(game: CatalogGame, targetId: string): boolean {
    const categoryId = this.slugify(game.category || '');
    if (categoryId === targetId) {
      return true;
    }
    const subcategory = game.subcategory || '';
    if (!subcategory) {
      return false;
    }
    const subId = `${categoryId}/${this.slugify(subcategory)}`;
    return subId === targetId;
  }

  private normalizeCategoryId(raw: string): string | null {
    const cleaned = raw.replace(/\\/g, '/').trim();
    if (!cleaned) {
      return null;
    }
    const segments = cleaned
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length === 0) {
      return null;
    }
    return segments.map((s) => this.slugify(s)).join('/');
  }
}
