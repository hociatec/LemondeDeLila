import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameSingleActionDto, GameStateWithActions } from '../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import { MorpionPresenter } from './morpion.presenter';
import type { GameShortcutHint, GameShortcutsContext } from '../../../engine/shortcuts/game-shortcuts';
export declare class MorpionService extends AbstractGameService {
    private readonly presenter;
    readonly gameType = "morpion";
    readonly category = "JeuxDePlateaux";
    readonly subcategory = "Les Vents Sacr\u00E9s";
    readonly displayName = "Morpion";
    readonly description = "Alignez 3 symboles sur une grille 3\u00D73.";
    readonly minPlayers = 2;
    readonly maxPlayers = 2;
    constructor(registry: GameRegistryService, presenter: MorpionPresenter);
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[];
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
    getShortcuts(_ctx: GameShortcutsContext<any>): GameShortcutHint[];
    private applyOne;
    private nextPlayerId;
    private detectWinner;
    private findWinningMove;
    private appendLog;
    private toCellRef;
    private glyphForOwner;
}
