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
import * as Rulebook from '../../rulebook/rulebook';
import { LesMainsActionService } from './les-mains-de-la-terre-action.service';
import { LesMainsDeLaTerreBotService } from './les-mains-de-la-terre-bot.service';
import { LesMainsPresenterService } from './les-mains-de-la-terre-presenter.service';
import { LesMainsSetupService } from './les-mains-de-la-terre-setup.service';
import { LES_MAINS_GAME } from '../../definitions/game.definition';
import { buildLesMainsDeLaTerreShortcuts } from '../../les-mains-de-la-terre.shortcuts';

export class LesMainsDeLaTerreService extends AbstractGameService {
  readonly gameType = LES_MAINS_GAME.id;
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = LES_MAINS_GAME.displayName;
  readonly description =
    'Complétez des familles de métiers tout en jouant des cartes spéciales déboussolantes.';
  readonly minPlayers = LES_MAINS_GAME.minPlayers;
  readonly maxPlayers = LES_MAINS_GAME.maxPlayers;

  constructor(
    private readonly setup: LesMainsSetupService,
    private readonly actions: LesMainsActionService,
    private readonly presenter: LesMainsPresenterService,
    private readonly bots: LesMainsDeLaTerreBotService,
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
    return buildLesMainsDeLaTerreShortcuts(ctx);
  }
}






