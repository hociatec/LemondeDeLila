import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../core/application/models/game-action.model';
import { AbstractGameService } from '../../../../../core/application/services/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../shortcuts/public-api';
import { SAC_A_MALICES_GAME } from '../../definitions/sac-a-malices.definition';
import { SacAMalicesSetupService } from './sac-a-malices-setup.service';
import { SacAMalicesActionService } from './sac-a-malices-action.service';
import { SacAMalicesPresenterService } from './sac-a-malices-presenter.service';
import { SacAMalicesBotService } from './sac-a-malices-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildSacAMalicesShortcuts } from '../../sac-a-malices.shortcuts';

export class SacAMalicesService extends AbstractGameService {
  readonly gameType = 'sac-a-malices';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = SAC_A_MALICES_GAME.displayName;
  readonly description = 'Monopoly Dijon (Chouette et Fortune).';
  readonly minPlayers = SAC_A_MALICES_GAME.minPlayers;
  readonly maxPlayers = SAC_A_MALICES_GAME.maxPlayers;

  constructor(
    private readonly setup: SacAMalicesSetupService,
    private readonly actions: SacAMalicesActionService,
    private readonly presenter: SacAMalicesPresenterService,
    private readonly bots: SacAMalicesBotService,
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
    return buildSacAMalicesShortcuts(ctx);
  }
}








