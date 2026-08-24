import type { GameStateEntity } from '../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../models/game-action.model';
import { AbstractGameService } from '../../../application/services/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../models/game-shortcuts.model';
import * as Rulebook from '../../rulebook/rulebook';
import { AbsurdissimesActionService } from './les-absurdissimes-action.service';
import { AbsurdissimesBotService } from './les-absurdissimes-bot.service';
import { AbsurdissimesPresenterService } from './les-absurdissimes-presenter.service';
import { AbsurdissimesSetupService } from './les-absurdissimes-setup.service';
import { ABSURDISSIMES_GAME } from '../../definitions/game.definition';
import { buildAbsurdissimesShortcuts } from './les-absurdissimes.shortcuts';

export class LesAbsurdissimesService extends AbstractGameService {
  readonly gameType = ABSURDISSIMES_GAME.id;
  readonly category = 'Cartes';
  readonly subcategory = 'VentsDansants';
  readonly displayName = ABSURDISSIMES_GAME.displayName;
  readonly description =
    'Proposez les rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ponses les plus absurdes et convainquez le juge pour remporter la manche.';
  readonly minPlayers = ABSURDISSIMES_GAME.minPlayers;
  readonly maxPlayers = ABSURDISSIMES_GAME.maxPlayers;

  constructor(
    private readonly setup: AbsurdissimesSetupService,
    private readonly actions: AbsurdissimesActionService,
    private readonly presenter: AbsurdissimesPresenterService,
    private readonly bots: AbsurdissimesBotService,
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
    return buildAbsurdissimesShortcuts(ctx);
  }
}






