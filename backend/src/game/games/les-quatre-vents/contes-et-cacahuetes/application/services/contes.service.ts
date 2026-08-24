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
import { CONTES_CACAHUETES_GAME } from '../../definitions/game.definition';
import { ContesCacahuetesSetupService } from './contes-et-cacahuetes-setup.service';
import { ContesActionService } from './contes-action.service';
import { ContesPresenterService } from './contes-presenter.service';
import { ContesBotService } from './contes-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildContesShortcuts } from '../../contes.shortcuts';

export class ContesService extends AbstractGameService {
  readonly gameType = 'contes-et-cacahuetes';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = CONTES_CACAHUETES_GAME.displayName;
  readonly description =
    'Course sur 60 cases avec contes, bonus, malus et surprises.';
  readonly minPlayers = CONTES_CACAHUETES_GAME.minPlayers;
  readonly maxPlayers = CONTES_CACAHUETES_GAME.maxPlayers;

  constructor(
    private readonly setup: ContesCacahuetesSetupService,
    private readonly actions: ContesActionService,
    private readonly presenter: ContesPresenterService,
    private readonly bots: ContesBotService,
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
    return buildContesShortcuts(ctx);
  }
}









