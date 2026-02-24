import { GameRegistryService } from '../../game/engine/services/game-registry.service';
export type CatalogGame = {
    id: string;
    name: string;
    status: string;
    minPlayers: number;
    maxPlayers: number;
    chatEnabled: boolean;
    chatSoundsEnabled: boolean;
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
export declare class CatalogService {
    private readonly registry;
    private cachedGames;
    private cacheExpiresAt;
    private readonly cacheTtlMs;
    constructor(registry: GameRegistryService);
    getAllGames(): Promise<CatalogGame[]>;
    getCategories(): Promise<string[]>;
    getGame(id: string): Promise<CatalogGame | undefined>;
    getCategoriesTree(): Promise<CategoryNode[]>;
    getFlatCategories(): Promise<FlatCategory[]>;
    getGamesForCategory(rawId: string): Promise<CatalogGame[]>;
    clearCache(): void;
    private loadFromRegistry;
    private formatCategoryName;
    private slugify;
    private buildCategoryRefs;
    private buildTreeFromGames;
    private listCategories;
    private gameMatchesCategory;
    private normalizeCategoryId;
}
