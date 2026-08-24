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
import { GALOPONS_GAME } from '../../definitions/galopons.definition';
import { GaloponsSetupService } from './galopons-setup.service';
import { GaloponsActionService } from './galopons-action.service';
import { GaloponsPresenterService } from './galopons-presenter.service';
import { GaloponsBotService } from './galopons-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildGaloponsShortcuts } from '../../galopons.shortcuts';

export class GaloponsEnsembleService extends AbstractGameService {
  readonly gameType = 'galopons-ensemble';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = GALOPONS_GAME.displayName;
  readonly description = 'Course équestre avec pommes et cartes.';
  readonly minPlayers = GALOPONS_GAME.minPlayers;
  readonly maxPlayers = GALOPONS_GAME.maxPlayers;

  constructor(
    private readonly setup: GaloponsSetupService,
    private readonly actions: GaloponsActionService,
    private readonly presenter: GaloponsPresenterService,
    private readonly bots: GaloponsBotService,
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

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(ctx: GameShortcutsContext<unknown>): GameShortcutHint[] {
    return buildGaloponsShortcuts(ctx);
  }

  shouldAnnounceBoardArrivals(): boolean {
    return false;
  }
}





