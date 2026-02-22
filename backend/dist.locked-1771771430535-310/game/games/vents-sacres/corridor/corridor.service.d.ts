import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameSingleActionDto, GameStateWithActions } from '../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import { CorridorSetupService } from './setup/corridor-setup.service';
import { CorridorActionService } from './actions/corridor-action.service';
import { CorridorPresenterService } from './presenter/corridor-presenter.service';
import { CorridorBotService } from './bots/corridor-bot.service';
export declare class CorridorService extends AbstractGameService {
    private readonly setup;
    private readonly actions;
    private readonly presenter;
    private readonly bots;
    readonly gameType = "corridor";
    readonly category = "JeuxDePlateaux";
    readonly subcategory = "Les Vents Sacr\u00E9s";
    readonly displayName: "Le Corridor";
    readonly description = "D\u00E9placez votre pion sur une grille (9\u00D79) et atteignez le bord oppos\u00E9.";
    readonly minPlayers: 2;
    readonly maxPlayers: 2;
    constructor(registry: GameRegistryService, setup: CorridorSetupService, actions: CorridorActionService, presenter: CorridorPresenterService, bots: CorridorBotService);
    registry: GameRegistryService;
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[];
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
}
