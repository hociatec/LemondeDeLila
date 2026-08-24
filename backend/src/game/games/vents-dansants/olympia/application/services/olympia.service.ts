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
import { OlympiaActionService } from './olympia-action.service';
import { OlympiaPresenterService } from './olympia-presenter.service';
import { OlympiaSetupService } from './olympia-setup.service';
import { OlympiaBotService } from './olympia-bot.service';
import { OLYMPIA_GAME } from '../../definitions/game.definition';
import { buildOlympiaShortcuts } from '../../olympia.shortcuts';

export class OlympiaService extends AbstractGameService {
  readonly gameType = 'olympia';
  readonly category = 'JeuxDeCartes';
  readonly subcategory = 'VentsDansants';
  readonly displayName = OLYMPIA_GAME.displayName;
  readonly description =
    'Accumulez un maximum de prestige divin en jouant vos hÃƒÆ’Ã‚Â©ros, exploits, crÃƒÆ’Ã‚Â©atures, actions, attaques et ÃƒÆ’Ã‚Â©vÃƒÆ’Ã‚Â©nements.';
  readonly minPlayers = OLYMPIA_GAME.minPlayers;
  readonly maxPlayers = OLYMPIA_GAME.maxPlayers;

  constructor(
    private readonly setup: OlympiaSetupService,
    private readonly actions: OlympiaActionService,
    private readonly presenter: OlympiaPresenterService,
    private readonly bots: OlympiaBotService,
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
    return buildOlympiaShortcuts(ctx);
  }
}






