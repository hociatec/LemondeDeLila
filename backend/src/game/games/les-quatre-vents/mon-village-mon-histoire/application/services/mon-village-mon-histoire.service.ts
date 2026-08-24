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
import { MON_VILLAGE_GAME } from '../../definitions/mon-village.definition';
import { MonVillageActionService } from './mon-village-action.service';
import { MonVillagePresenterService } from './mon-village-presenter.service';
import { MonVillageSetupService } from './mon-village-setup.service';
import { MonVillageBotService } from './mon-village-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildMonVillageShortcuts } from '../../shortcuts/mon-village.shortcuts';

export class MonVillageService extends AbstractGameService {
  readonly gameType = 'mon-village-mon-histoire';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = MON_VILLAGE_GAME.displayName;
  readonly description =
    'Parcourez les métiers et collectionnez les cartes qui feront la richesse de votre village.';
  readonly minPlayers = MON_VILLAGE_GAME.minPlayers;
  readonly maxPlayers = MON_VILLAGE_GAME.maxPlayers;

  constructor(
    private readonly setup: MonVillageSetupService,
    private readonly actions: MonVillageActionService,
    private readonly presenter: MonVillagePresenterService,
    private readonly bots: MonVillageBotService,
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
    return buildMonVillageShortcuts(ctx);
  }
}





