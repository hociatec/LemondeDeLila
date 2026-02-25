import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { GameDefinition } from '../interfaces/game-rules-adapter.interface';
import { GameCatalogOverrideEntity } from '../entities/game-catalog-override.entity';
export type GameCatalogStatus = 'construction' | 'beta' | 'finished';
export type GameCatalogOverride = {
    enabled?: boolean;
    minPlayers?: number;
    maxPlayers?: number;
    name?: string;
    description?: string;
    rules?: string;
    status?: string;
    chatEnabled?: boolean;
    chatSoundsEnabled?: boolean;
};
type OverridesRoot = {
    games: Record<string, GameCatalogOverride>;
};
export type GameDefinitionWithOverrides = GameDefinition & {
    enabled?: boolean;
    status?: GameCatalogStatus;
};
export declare class GameCatalogOverridesService implements OnModuleInit {
    private readonly repo;
    private readonly logger;
    private cache;
    private static normalizeStatus;
    constructor(repo: Repository<GameCatalogOverrideEntity>);
    onModuleInit(): Promise<void>;
    getOverrides(): OverridesRoot;
    getGameOverride(gameType: string): GameCatalogOverride | null;
    apply(def: GameDefinition): GameDefinitionWithOverrides;
    setEnabled(gameType: string, enabled: boolean): Promise<void>;
    updateGameOverride(gameType: string, update: GameCatalogOverride): Promise<GameCatalogOverride>;
    clearGameOverride(gameType: string): Promise<void>;
    private ensureLoaded;
}
export {};
