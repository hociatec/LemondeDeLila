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
import { VOYAGE_GAME } from '../../definitions/voyage.definition';
import { VoyageSetupService } from './voyage-setup.service';
import { VoyageActionService } from './voyage-action.service';
import { VoyagePresenterService } from './voyage-presenter.service';
import { VoyageBotService } from './voyage-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildVoyageShortcuts } from '../../voyage.shortcuts';

export class VoyageService extends AbstractGameService {
  readonly gameType = 'voyage-en-terre-de-brumes';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = VOYAGE_GAME.displayName;
  readonly description =
    'Voyage en Irlande : quiz de légendes, farces et trésors.';
  readonly minPlayers = VOYAGE_GAME.minPlayers;
  readonly maxPlayers = VOYAGE_GAME.maxPlayers;

  constructor(
    private readonly setup: VoyageSetupService,
    private readonly actions: VoyageActionService,
    private readonly presenter: VoyagePresenterService,
    private readonly bots: VoyageBotService,
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
    return buildVoyageShortcuts(ctx);
  }
}





