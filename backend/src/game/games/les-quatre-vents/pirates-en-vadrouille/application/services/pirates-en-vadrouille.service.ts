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
import { PIRATES_GAME } from '../../definitions/pirates-en-vadrouille.definition';
import { PiratesEnVadrouilleSetupService } from './pirates-en-vadrouille-setup.service';
import { PiratesEnVadrouilleActionService } from './pirates-en-vadrouille-action.service';
import { PiratesEnVadrouillePresenterService } from './pirates-en-vadrouille-presenter.service';
import { PiratesEnVadrouilleBotService } from './pirates-en-vadrouille-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildPiratesEnVadrouilleShortcuts } from '../../shortcuts/pirates-en-vadrouille.shortcuts';

export class PiratesEnVadrouilleService extends AbstractGameService {
  readonly gameType = 'pirates-en-vadrouille';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = PIRATES_GAME.displayName;
  readonly description =
    'Parcourez lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â®le Papayousse, piochez bonus ou obstacles et rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©coltez trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sors et piÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ces dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢or.';
  readonly minPlayers = PIRATES_GAME.minPlayers;
  readonly maxPlayers = PIRATES_GAME.maxPlayers;

  constructor(
    private readonly setup: PiratesEnVadrouilleSetupService,
    private readonly actions: PiratesEnVadrouilleActionService,
    private readonly presenter: PiratesEnVadrouillePresenterService,
    private readonly bots: PiratesEnVadrouilleBotService,
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
    return buildPiratesEnVadrouilleShortcuts(ctx);
  }
}








