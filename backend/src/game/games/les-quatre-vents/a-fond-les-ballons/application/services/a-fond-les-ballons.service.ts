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
import { A_FOND_LES_BALLONS_GAME } from '../../definitions/game.definition';
import { AFondLesBallonsSetupService } from './a-fond-les-ballons-setup.service';
import { AFondLesBallonsActionService } from './a-fond-les-ballons-action.service';
import { AFondLesBallonsPresenterService } from './a-fond-les-ballons-presenter.service';
import { AFondLesBallonsBotService } from './a-fond-les-ballons-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildAFondLesBallonsShortcuts } from '../../a-fond-les-ballons.shortcuts';

export class AFondLesBallonsService extends AbstractGameService {
  readonly gameType = 'a-fond-les-ballons';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = A_FOND_LES_BALLONS_GAME.displayName;
  readonly description = "Course déjantée jusqu'à la Grosse Noix Dorée.";
  readonly minPlayers = A_FOND_LES_BALLONS_GAME.minPlayers;
  readonly maxPlayers = A_FOND_LES_BALLONS_GAME.maxPlayers;

  constructor(
    private readonly setup: AFondLesBallonsSetupService,
    private readonly actions: AFondLesBallonsActionService,
    private readonly presenter: AFondLesBallonsPresenterService,
    private readonly bots: AFondLesBallonsBotService,
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
    return buildAFondLesBallonsShortcuts(ctx);
  }
}





