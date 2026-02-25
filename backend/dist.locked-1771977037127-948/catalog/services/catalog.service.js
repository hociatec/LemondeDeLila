"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const game_registry_service_1 = require("../../game/engine/services/game-registry.service");
let CatalogService = class CatalogService {
    registry;
    cachedGames = null;
    cacheExpiresAt = 0;
    cacheTtlMs;
    constructor(registry) {
        this.registry = registry;
        const ttlCandidate = Number(process.env.GAME_CATALOG_CACHE_TTL_MS ?? 30000);
        this.cacheTtlMs =
            Number.isFinite(ttlCandidate) && ttlCandidate >= 0 ? ttlCandidate : 30000;
    }
    async getAllGames() {
        if (this.cachedGames &&
            (this.cacheTtlMs === 0 || Date.now() < this.cacheExpiresAt)) {
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
    async getCategories() {
        const games = await this.getAllGames();
        const categories = new Set();
        games.forEach((game) => categories.add(game.category));
        return Array.from(categories);
    }
    async getGame(id) {
        const games = await this.getAllGames();
        return games.find((game) => game.id === id);
    }
    async getCategoriesTree() {
        const games = await this.getAllGames();
        return this.buildTreeFromGames(games);
    }
    async getFlatCategories() {
        const games = await this.getAllGames();
        return this.listCategories(games);
    }
    async getGamesForCategory(rawId) {
        const target = this.normalizeCategoryId(rawId);
        if (!target) {
            return [];
        }
        return (await this.getAllGames()).filter((game) => this.gameMatchesCategory(game, target));
    }
    clearCache() {
        this.cachedGames = null;
        this.cacheExpiresAt = 0;
    }
    async loadFromRegistry() {
        const definitions = await this.registry.listGames();
        const mapped = definitions.map((def) => {
            const rawCategory = this.formatCategoryName(def.category || 'Catalogue');
            const rawSubcategory = this.formatCategoryName(def.subcategory || '');
            const category = rawSubcategory || rawCategory;
            const withStatus = def;
            const status = typeof withStatus.status === 'string' ? withStatus.status : 'finished';
            const subcategory = '';
            const categories = this.buildCategoryRefs(category, subcategory);
            return {
                id: def.id,
                name: def.name,
                status,
                minPlayers: def.minPlayers ?? 2,
                maxPlayers: def.maxPlayers ?? 6,
                chatEnabled: typeof def.chatEnabled === 'boolean' ? def.chatEnabled : true,
                chatSoundsEnabled: typeof def.chatSoundsEnabled === 'boolean'
                    ? def.chatSoundsEnabled
                    : true,
                summary: def.description ?? '',
                engine: def.id,
                category,
                subcategory,
                categories,
            };
        });
        const byId = new Map();
        for (const game of mapped) {
            const id = String(game?.id ?? '').trim();
            if (!id)
                continue;
            if (!byId.has(id)) {
                byId.set(id, game);
            }
        }
        return Array.from(byId.values());
    }
    formatCategoryName(name) {
        if (!name)
            return '';
        const spaced = name
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ');
        return spaced
            .split(' ')
            .filter(Boolean)
            .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
            .join(' ');
    }
    slugify(value) {
        const noAccent = value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        return noAccent.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    buildCategoryRefs(categoryName, subcategoryName) {
        const refs = [];
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
    buildTreeFromGames(games) {
        const categories = {};
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
    listCategories(games) {
        const categories = {};
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
    gameMatchesCategory(game, targetId) {
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
    normalizeCategoryId(raw) {
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
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_registry_service_1.GameRegistryService])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map