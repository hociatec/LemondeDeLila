import { GameCoreService } from '../../../../core/services/game-core.service';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
import { PanierExpressDeckService } from './panier-express-deck.service';
import { InteractiveExchangeService } from '../../../../modules/exchange/services/interactive-exchange.service';
import { PanierExpressSetupService } from '../setup/panier-express-setup.service';
import { RandomService } from '../../../../modules/random/services/random.service';
export declare class PanierExpressExchangeService {
    private readonly core;
    private readonly utils;
    private readonly deckHelper;
    private readonly exchangeFlow;
    private readonly setup;
    private readonly random;
    constructor(core: GameCoreService, utils: PanierExpressUtils, deckHelper: PanierExpressDeckService, exchangeFlow: InteractiveExchangeService, setup: PanierExpressSetupService, random: RandomService);
    applyExchange(state: GameStateEntity, playerId: number): GameStateEntity;
    chooseTarget(state: GameStateEntity, playerId: number, targetPlayerId: number): GameStateEntity;
    chooseGive(state: GameStateEntity, playerId: number, give: string): GameStateEntity;
    acceptOffer(state: GameStateEntity, targetPlayerId: number): GameStateEntity;
    refuseOffer(state: GameStateEntity, targetPlayerId: number): GameStateEntity;
    applyExchangeCard(state: GameStateEntity, initiatorPlayerId: number, targetPlayerId: number, card: string): GameStateEntity;
    private requestExchange;
    private adapter;
}
