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
import { LaGrandeMineDeBarbakActionService } from './la-grande-mine-de-barbak-action.service';
import { LaGrandeMineDeBarbakPresenterService } from './la-grande-mine-de-barbak-presenter.service';
import { LaGrandeMineSetupService } from './la-grande-mine-de-barbak-setup.service';
import { LaGrandeMineDeBarbakBotService } from './la-grande-mine-de-barbak-bot.service';
import { LA_GRANDE_MINE_GAME } from '../../definitions/game.definition';
import { buildLaGrandeMineDeBarbakShortcuts } from './la-grande-mine-de-barbak.shortcuts';

export class LaGrandeMineDeBarbakService extends AbstractGameService {
  readonly gameType = 'la-grande-mine-de-barbak';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = LA_GRANDE_MINE_GAME.displayName;
  readonly description =
    'Explorez la mine, posez vos trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sors et affrontez vos adversaires pour devenir le Nain suprÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªme.';
  readonly minPlayers = LA_GRANDE_MINE_GAME.minPlayers;
  readonly maxPlayers = LA_GRANDE_MINE_GAME.maxPlayers;

  constructor(
    private readonly setup: LaGrandeMineSetupService,
    private readonly actions: LaGrandeMineDeBarbakActionService,
    private readonly presenter: LaGrandeMineDeBarbakPresenterService,
    private readonly bots: LaGrandeMineDeBarbakBotService,
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
    return buildLaGrandeMineDeBarbakShortcuts(ctx);
  }
}






