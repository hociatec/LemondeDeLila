import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { GameCategoriesService } from '../../game/engine/services/game-categories.service';
import { GameCatalogOverridesService } from '../../game/engine/services/game-catalog-overrides.service';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';
import { AdminCatalogInvalidationService } from '../services/admin-catalog-invalidation.service';
export declare class AdminGamesWsHandler {
    private readonly validator;
    private readonly registry;
    private readonly overrides;
    private readonly categories;
    private readonly catalogInvalidation;
    constructor(validator: PayloadValidationService, registry: GameRegistryService, overrides: GameCatalogOverridesService, categories: GameCategoriesService, catalogInvalidation: AdminCatalogInvalidationService);
    private buildCategoriesPayload;
    gamesList(session: WsSession): Promise<{
        type: string;
        payload: {
            games: {
                id: string;
                name: string;
                category: string;
                categoryId: string | undefined;
                subcategory: string | undefined;
                description: string | undefined;
                rules: string | undefined;
                minPlayers: number | undefined;
                maxPlayers: number | undefined;
                enabled: boolean;
                status: string;
                chatEnabled: boolean;
                chatSoundsEnabled: boolean;
            }[];
        };
    }>;
    gamesCategoriesList(session: WsSession, payload: any): {
        type: string;
        payload: {
            categories: import("../../game/engine/services/game-categories.service").GameCategory[];
            assignments: Record<string, string | null>;
        };
    };
    gamesCategoryCreate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            categories: import("../../game/engine/services/game-categories.service").GameCategory[];
            assignments: Record<string, string | null>;
        };
    }>;
    gamesCategoryUpdate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            categories: import("../../game/engine/services/game-categories.service").GameCategory[];
            assignments: Record<string, string | null>;
        };
    }>;
    gamesCategoryAssign(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            categories: import("../../game/engine/services/game-categories.service").GameCategory[];
            assignments: Record<string, string | null>;
        };
    }>;
    gamesCategoryDelete(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            categories: import("../../game/engine/services/game-categories.service").GameCategory[];
            assignments: Record<string, string | null>;
        };
    }>;
    gamesSetEnabled(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            ok: boolean;
        };
    }>;
    gamesUpdate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            ok: boolean;
        };
    }>;
    gamesReset(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            ok: boolean;
        };
    }>;
}
