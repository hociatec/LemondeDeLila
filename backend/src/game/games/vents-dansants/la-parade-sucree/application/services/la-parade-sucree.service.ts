import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../application/models/game-action.model';
import { AbstractGameService } from '../../../../../application/services/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../application/models/game-shortcuts.model';
import * as Rulebook from '../../rulebook/rulebook';
import { LaParadeSucreeActionService } from './la-parade-sucree-action.service';
import { LaParadeSucreePresenterService } from './la-parade-sucree-presenter.service';
import { LaParadeSucreeSetupService } from './la-parade-sucree-setup.service';
import { LaParadeSucreeBotService } from './la-parade-sucree-bot.service';
import { LA_PARADE_SUCREE_GAME } from '../../definitions/game.definition';
import { buildLaParadeSucreeShortcuts } from '../../la-parade-sucree.shortcuts';

export class LaParadeSucreeService extends AbstractGameService {
  readonly gameType = 'la-parade-sucree';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = LA_PARADE_SUCREE_GAME.displayName;
  readonly description =
    'Posez les cartes dans l’ordre et collectionnez les friandises des cases spéciales.';
  readonly minPlayers = LA_PARADE_SUCREE_GAME.minPlayers;
  readonly maxPlayers = LA_PARADE_SUCREE_GAME.maxPlayers;

  constructor(
    private readonly setup: LaParadeSucreeSetupService,
    private readonly actions: LaParadeSucreeActionService,
    private readonly presenter: LaParadeSucreePresenterService,
    private readonly bots: LaParadeSucreeBotService,
  ) {
    super();
  }
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return this.setup.hydrateInitialState(baseState);
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return this.actions.applyActions(state, actions);
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    return Rulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return Rulebook.validateAction(state, action, actorId);
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  getShortcuts(ctx: GameShortcutsContext<unknown>): GameShortcutHint[] {
    return buildLaParadeSucreeShortcuts(ctx);
  }
}






