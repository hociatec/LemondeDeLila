import { GameRegistryService } from './game-registry.service';
import { GameCatalogOverridesService } from './game-catalog-overrides.service';
export declare class GameContentService {
    private readonly registry;
    private readonly overrides;
    private readonly rulesCache;
    private readonly devTtlMs;
    constructor(registry: GameRegistryService, overrides: GameCatalogOverridesService);
    getRules(gameType: string): Promise<string>;
}
