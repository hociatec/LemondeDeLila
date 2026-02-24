import { OnModuleInit } from '@nestjs/common';
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
export declare class GameCategoriesService implements OnModuleInit {
    private readonly categoriesRepo;
    private readonly assignmentsRepo;
    private readonly mirror;
    private readonly logger;
    private cache;
    private static readonly AliasToCategoryId;
    constructor(categoriesRepo: Repository<GameCategoryEntity>, assignmentsRepo: Repository<GameCategoryAssignmentEntity>, mirror: GameCategoriesFsMirrorService);
    onModuleInit(): Promise<void>;
    getCategories(): GameCategory[];
    getCategory(id: string): GameCategory | undefined;
    getAssignment(gameType: string): string | null;
    listAssignments(): Record<string, string | null>;
    assignCategory(gameType: string, categoryId: string | null): Promise<void>;
    createCategory(name: string, parentId?: string | null): Promise<GameCategory>;
    updateCategory(id: string, data: {
        name?: string;
        parentId?: string | null;
    }): Promise<GameCategory>;
    deleteCategory(id: string): Promise<void>;
    applyToDefinition(def: GameDefinition): GameDefinition;
    private inferCategoryFromDefinition;
    private normalizeLabel;
    private getRoot;
    private ensureLoaded;
    private syncMirrorBestEffort;
    private ensureUniqueId;
    private slugify;
}
