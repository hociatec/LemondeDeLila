import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { PanierExpressSetupService } from '../setup/panier-express-setup.service';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
import { PanierExpressDeckService } from './panier-express-deck.service';
export declare class PanierExpressDrawService {
    private readonly setup;
    private readonly core;
    private readonly utils;
    private readonly deckHelper;
    private static readonly MAX_INVENTORY;
    constructor(setup: PanierExpressSetupService, core: GameCoreService, utils: PanierExpressUtils, deckHelper: PanierExpressDeckService);
    drawCourse(state: GameStateEntity, playerId: number, standId?: string): GameStateEntity;
    private drawAtStand;
    private findStandAtPosition;
}
