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
import { FROUSSE_GAME } from '../../definitions/frousse.definition';
import { FrousseSetupService } from './frousse-setup.service';
import { FrousseActionService } from './frousse-action.service';
import { FroussePresenterService } from './frousse-presenter.service';
import { FrousseBotService } from './frousse-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildFrousseShortcuts } from '../../frousse.shortcuts';

export class FroussePartyService extends AbstractGameService {
  readonly gameType = 'frousse-party';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = FROUSSE_GAME.displayName;
  readonly description = 'Course dans un manoir avec cartes surprises.';
  readonly minPlayers = FROUSSE_GAME.minPlayers;
  readonly maxPlayers = FROUSSE_GAME.maxPlayers;

  constructor(
    private readonly setup: FrousseSetupService,
    private readonly actions: FrousseActionService,
    private readonly presenter: FroussePresenterService,
    private readonly bots: FrousseBotService,
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
    return buildFrousseShortcuts(ctx);
  }
}





