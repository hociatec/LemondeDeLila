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
import { ODYSSEE_GAME } from '../../definitions/odyssee.definition';
import { OdysseeSetupService } from './odyssee-setup.service';
import { OdysseeActionService } from './odyssee-action.service';
import { OdysseePresenterService } from './odyssee-presenter.service';
import { OdysseeBotService } from './odyssee-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildOdysseeShortcuts } from '../../odyssee.shortcuts';

export class OdysseeQuatreCieuxService extends AbstractGameService {
  readonly gameType = 'odyssee-quatre-cieux';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = ODYSSEE_GAME.displayName;
  readonly description = 'Course galactique (type petits chevaux).';
  readonly minPlayers = ODYSSEE_GAME.minPlayers;
  readonly maxPlayers = ODYSSEE_GAME.maxPlayers;

  constructor(
    private readonly setup: OdysseeSetupService,
    private readonly actions: OdysseeActionService,
    private readonly presenter: OdysseePresenterService,
    private readonly bots: OdysseeBotService,
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
    return buildOdysseeShortcuts(ctx);
  }
}
