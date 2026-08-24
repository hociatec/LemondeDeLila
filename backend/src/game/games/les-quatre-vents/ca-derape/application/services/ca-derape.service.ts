import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../models/game-action.model';
import { AbstractGameService } from '../../../../../application/services/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../models/game-shortcuts.model';
import { CA_DERAPE_GAME } from '../../definitions/ca.definition';
import { CaSetupService } from '../../setup/ca.setup';
import { CaActionService } from './ca-actions.service';
import { CaPresenterService } from './ca-presenter.service';
import { CaBotService } from './ca-bot.service';
import * as Rulebook from '../../rulebook/ca.rulebook';
import { buildCaDerapeShortcuts } from '../../ca-derape.shortcuts';

export class CaDerapeService extends AbstractGameService {
  readonly gameType = 'ca-derape';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = CA_DERAPE_GAME.displayName;
  readonly description = 'Course chaotique sur 30 cases avec cartes Situation.';
  readonly minPlayers = CA_DERAPE_GAME.minPlayers;
  readonly maxPlayers = CA_DERAPE_GAME.maxPlayers;

  constructor(
    private readonly setup: CaSetupService,
    private readonly actions: CaActionService,
    private readonly presenter: CaPresenterService,
    private readonly bots: CaBotService,
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
    return buildCaDerapeShortcuts(ctx);
  }
}





