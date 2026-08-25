import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../core/application/models/game-action.model';
import { AbstractGameService } from '../../../../../core/application/services/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../shortcuts/public-api';
import * as Rulebook from '../../rulebook/rulebook';
import { GerardPresidentActionService } from './gerard-president-action.service';
import { GerardPresidentBotService } from './gerard-president-bot.service';
import { GerardPresidentPresenterService } from './gerard-president-presenter.service';
import { GerardPresidentSetupService } from './gerard-president-setup.service';
import { GERARD_PRESIDENT_GAME } from '../../definitions/game.definition';
import { buildGerardPresidentShortcuts } from '../../gerard-president.shortcuts';

export class GerardPresidentService extends AbstractGameService {
  readonly gameType = 'gerard-president';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = GERARD_PRESIDENT_GAME.displayName;
  readonly description =
    'Un jeu d’humour où le prénom le plus absurde remporte les manches.';
  readonly minPlayers = GERARD_PRESIDENT_GAME.minPlayers;
  readonly maxPlayers = GERARD_PRESIDENT_GAME.maxPlayers;

  constructor(
    private readonly setup: GerardPresidentSetupService,
    private readonly actions: GerardPresidentActionService,
    private readonly presenter: GerardPresidentPresenterService,
    private readonly bots: GerardPresidentBotService,
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
    return buildGerardPresidentShortcuts(ctx);
  }
}






