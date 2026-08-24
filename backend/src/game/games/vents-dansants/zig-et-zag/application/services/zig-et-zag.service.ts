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
import { ZigEtZagActionService } from './zig-et-zag-action.service';
import { ZigEtZagPresenterService } from './zig-et-zag-presenter.service';
import { ZigEtZagSetupService } from './zig-et-zag-setup.service';
import { ZigEtZagBotService } from './zig-et-zag-bot.service';
import { ZIG_ET_ZAG_GAME } from '../../definitions/game.definition';
import { buildZigEtZagShortcuts } from '../../zig-et-zag.shortcuts';

export class ZigEtZagService extends AbstractGameService {
  readonly gameType = 'zig-et-zag';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = ZIG_ET_ZAG_GAME.displayName;
  readonly description =
    'Bataille tendre oÃƒÂ¹ chaque duel ramasse les cartes en jeu.';
  readonly minPlayers = ZIG_ET_ZAG_GAME.minPlayers;
  readonly maxPlayers = ZIG_ET_ZAG_GAME.maxPlayers;

  constructor(
    private readonly setup: ZigEtZagSetupService,
    private readonly actions: ZigEtZagActionService,
    private readonly presenter: ZigEtZagPresenterService,
    private readonly bots: ZigEtZagBotService,
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
    return buildZigEtZagShortcuts(ctx);
  }
}






