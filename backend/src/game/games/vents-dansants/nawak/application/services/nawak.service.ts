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
import { NawakActionService } from './nawak-action.service';
import { NawakBotService } from './nawak-bot.service';
import { NawakPresenterService } from './nawak-presenter.service';
import { NawakSetupService } from './nawak-setup.service';
import { NAWAK_GAME } from '../../definitions/game.definition';
import { buildNawakShortcuts } from './nawak.shortcuts';

export class NawakService extends AbstractGameService {
  readonly gameType = 'nawak';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = NAWAK_GAME.displayName;
  readonly description =
    'RÃƒÆ’Ã‚Â©pondez aux dÃƒÆ’Ã‚Â©fis absurdes, votez pour les rÃƒÆ’Ã‚Â©ponses ÃƒÆ’Ã‚Â©trangÃƒÆ’Ã‚Â¨res et cumulez les votes.';
  readonly minPlayers = NAWAK_GAME.minPlayers;
  readonly maxPlayers = NAWAK_GAME.maxPlayers;

  constructor(
    private readonly setup: NawakSetupService,
    private readonly actions: NawakActionService,
    private readonly presenter: NawakPresenterService,
    private readonly bots: NawakBotService,
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
    return buildNawakShortcuts(ctx);
  }
}






