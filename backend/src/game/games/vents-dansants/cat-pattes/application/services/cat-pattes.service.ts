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
import * as Rulebook from '../../rulebook/rulebook';
import { CatPattesActionService } from './cat-pattes-action.service';
import { CatPattesPresenterService } from './cat-pattes-presenter.service';
import { CatPattesSetupService } from './cat-pattes-setup.service';
import { CatPattesBotService } from './cat-pattes-bot.service';
import { CAT_PATTES_GAME } from '../../definitions/game.definition';
import { buildCatPattesShortcuts } from '../../cat-pattes.shortcuts';

export class CatPattesService extends AbstractGameService {
  readonly gameType = 'cat-pattes';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = CAT_PATTES_GAME.displayName;
  readonly description = 'Course fÃƒÆ’Ã‚Â©line jusquÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã‚Â  1 000 pattes.';
  readonly minPlayers = CAT_PATTES_GAME.minPlayers;
  readonly maxPlayers = CAT_PATTES_GAME.maxPlayers;

  constructor(
    private readonly setup: CatPattesSetupService,
    private readonly actions: CatPattesActionService,
    private readonly presenter: CatPattesPresenterService,
    private readonly bots: CatPattesBotService,
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
    return buildCatPattesShortcuts(ctx);
  }
}






