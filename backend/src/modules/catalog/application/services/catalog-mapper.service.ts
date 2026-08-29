import { Injectable } from '@nestjs/common';

import {
  CatalogGame,
  CategoryNode,
  FlatCategory,
} from '../models/catalog-game.record';
import { CatalogSourceGame } from '../models/catalog-source-game.record';

@Injectable()
export class CatalogMapperService {
  toCatalogGames(definitions: CatalogSourceGame[]): CatalogGame[] {
    const mapped = definitions.map((definition) => {
      const rawCategory = this.formatCategoryName(
        definition.category || 'Catalogue',
      );
      const rawSubcategory = this.formatCategoryName(
        definition.subcategory || '',
      );
      const category = rawSubcategory || rawCategory;
      const subcategory = '';
      const status =
        typeof definition.status === 'string' ? definition.status : 'finished';

      return {
        id: definition.id,
        name: definition.name,
        status,
        minPlayers: definition.minPlayers ?? 2,
        maxPlayers: definition.maxPlayers ?? 6,
        chatEnabled:
          typeof definition.chatEnabled === 'boolean'
            ? definition.chatEnabled
            : true,
        chatSoundsEnabled:
          typeof definition.chatSoundsEnabled === 'boolean'
            ? definition.chatSoundsEnabled
            : true,
        summary: definition.description ?? '',
        engine: definition.id,
        category,
        subcategory,
        categories: this.buildCategoryRefs(category, subcategory),
        manifestPath: definition.manifestPath,
        rulesPath: definition.rulesPath,
      } satisfies CatalogGame;
    });

    const byId = new Map<string, CatalogGame>();
    for (const game of mapped) {
      const id = String(game.id || '').trim();
      if (!id || byId.has(id)) {
        continue;
      }
      byId.set(id, game);
    }

    return Array.from(byId.values());
  }

  listCategoryNames(games: CatalogGame[]): string[] {
    const categories = new Set<string>();
    for (const game of games) {
      categories.add(game.category);
    }
    return Array.from(categories);
  }

  buildCategoryTree(games: CatalogGame[]): CategoryNode[] {
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

      if (!subcategoryName) {
        continue;
      }

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

    return Object.values(categories).map((node) => ({
      id: node.id,
      name: node.name,
      children: Object.values(node.childrenMap).map((child) => ({
        id: child.id,
        name: child.name,
        children: [],
      })),
    }));
  }

  buildFlatCategories(games: CatalogGame[]): FlatCategory[] {
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
      if (!subcategoryName) {
        continue;
      }

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

    return Object.values(categories);
  }

  normalizeCategoryId(raw: string): string | null {
    const cleaned = raw.replace(/\\/g, '/').trim();
    if (!cleaned) {
      return null;
    }
    const segments = cleaned
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.length === 0) {
      return null;
    }
    return segments.map((segment) => this.slugify(segment)).join('/');
  }

  matchesCategory(game: CatalogGame, targetId: string): boolean {
    const categoryId = this.slugify(game.category || '');
    if (categoryId === targetId) {
      return true;
    }
    const subcategory = game.subcategory || '';
    if (!subcategory) {
      return false;
    }
    return `${categoryId}/${this.slugify(subcategory)}` === targetId;
  }

  private formatCategoryName(name: string): string {
    if (!name) {
      return '';
    }
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

  private slugify(value: string): string {
    const noAccent = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return noAccent.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
}
