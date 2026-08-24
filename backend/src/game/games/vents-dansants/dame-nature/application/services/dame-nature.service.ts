import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../application/models/game-action.model';
import { AbstractGameService } from '../../../../../application/services/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../application/models/game-shortcuts.model';
import * as Rulebook from '../../rulebook/rulebook';
import { DameNatureActionService } from './dame-nature-action.service';
import { DameNaturePresenterService } from './dame-nature-presenter.service';
import { DameNatureSetupService } from './dame-nature-setup.service';
import { DameNatureBotService } from './dame-nature-bot.service';
import { DAME_NATURE_GAME } from '../../definitions/game.definition';
import { buildDameNatureShortcuts } from '../../dame-nature.shortcuts';

export class DameNatureService extends AbstractGameService {
  readonly gameType = 'dame-nature';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = DAME_NATURE_GAME.displayName;
  readonly description =
    'Collectez quatre familles complètes tout en protégeant Dame Nature des pollutions.';
  readonly minPlayers = DAME_NATURE_GAME.minPlayers;
  readonly maxPlayers = DAME_NATURE_GAME.maxPlayers;

  constructor(
    private readonly setup: DameNatureSetupService,
    private readonly actions: DameNatureActionService,
    private readonly presenter: DameNaturePresenterService,
    private readonly bots: DameNatureBotService,
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
    return buildDameNatureShortcuts(ctx);
  }
}






