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
import { PimpMyRideActionService } from './pimp-my-ride-action.service';
import { PimpMyRidePresenterService } from './pimp-my-ride-presenter.service';
import { PimpMyRideSetupService } from './pimp-my-ride-setup.service';
import { PimpMyRideBotService } from './pimp-my-ride-bot.service';
import { PIMP_MY_RIDE_GAME } from '../../definitions/game.definition';
import { buildPimpMyRideShortcuts } from '../../pimp-my-ride.shortcuts';

export class PimpMyRideService extends AbstractGameService {
  readonly gameType = 'pimp-my-ride';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = PIMP_MY_RIDE_GAME.displayName;
  readonly description =
    'Soyez le premier à construire trois voitures complètes en respectant l’ordre de construction classique.';
  readonly minPlayers = PIMP_MY_RIDE_GAME.minPlayers;
  readonly maxPlayers = PIMP_MY_RIDE_GAME.maxPlayers;

  constructor(
    private readonly setup: PimpMyRideSetupService,
    private readonly actions: PimpMyRideActionService,
    private readonly presenter: PimpMyRidePresenterService,
    private readonly bots: PimpMyRideBotService,
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
    return buildPimpMyRideShortcuts(ctx);
  }
}






