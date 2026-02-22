import { GameDefinition, GameRulesAdapter } from '../interfaces/game-rules-adapter.interface';
import { GameCatalogOverridesService } from './game-catalog-overrides.service';
import { GameCategoriesService } from './game-categories.service';
export declare class GameRegistryService {
    private readonly overrides;
    private readonly categories;
    private readonly handlers;
    private readonly gamesRoot;
    private readonly logger;
    private cachedDefinitions;
    private cachedAtMs;
    private readonly devTtlMs;
    constructor(overrides: GameCatalogOverridesService, categories: GameCategoriesService);
    invalidateCache(): void;
    getHandler(gameType: string): GameRulesAdapter | undefined;
    register(handler: GameRulesAdapter): void;
    listGames(options?: {
        includeDisabledOverrides?: boolean;
    }): Promise<GameDefinition[]>;
    private buildGameListFromDefinitions;
    private isCacheFresh;
    private enrichWithHandler;
    private loadDefinitionsFromFs;
    private findManifestPaths;
    private readDefinition;
    private formatName;
}
