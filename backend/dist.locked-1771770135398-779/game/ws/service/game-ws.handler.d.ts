import type { WsSession } from '../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../common/validation/payload-validation.service';
import { GameContentService } from '../../engine/services/game-content.service';
import { GameModuleOverviewRegistryService } from '../../modules/game-module-overview.service';
export declare class GameWsHandler {
    private readonly content;
    private readonly overviewRegistry;
    private readonly validator;
    constructor(content: GameContentService, overviewRegistry: GameModuleOverviewRegistryService, validator: PayloadValidationService);
    rules(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            rules: string;
            gameType: string;
        };
    }>;
    modules(session: WsSession): Promise<{
        type: string;
        payload: {
            modules: import("../../modules/dto/generic-module.dto").ModuleOverviewDto[];
        };
    }>;
}
