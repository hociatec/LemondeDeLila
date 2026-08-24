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
import { PRIMALIS_GAME } from '../../definitions/primalis.definition';
import { PrimalisSetupService } from './primalis-setup.service';
import { PrimalisActionService } from './primalis-action.service';
import { PrimalisPresenterService } from './primalis-presenter.service';
import { PrimalisBotService } from './primalis-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildPrimalisShortcuts } from '../../shortcuts/primalis.shortcuts';

export class PrimalisService extends AbstractGameService {
  readonly gameType = 'primalis';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = PRIMALIS_GAME.displayName;
  readonly description =
    'Survivez à la comète : construisez votre tribu de dinosaures et nourrissez-la avant la catastrophe finale.';
  readonly minPlayers = PRIMALIS_GAME.minPlayers;
  readonly maxPlayers = PRIMALIS_GAME.maxPlayers;

  constructor(
    private readonly setup: PrimalisSetupService,
    private readonly actions: PrimalisActionService,
    private readonly presenter: PrimalisPresenterService,
    private readonly bots: PrimalisBotService,
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
    return buildPrimalisShortcuts(ctx);
  }
}









