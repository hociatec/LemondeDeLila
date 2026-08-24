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
import { EntreRitesActionService } from './entre-rites-action.service';
import { EntreRitesPresenterService } from './entre-rites-presenter.service';
import { EntreRitesSetupService } from './entre-rites-setup.service';
import { EntreRitesBotService } from './entre-rites-bot.service';
import { ENTRE_RITES_GAME } from '../../definitions/game.definition';
import { buildEntreRitesShortcuts } from '../../entre-rites.shortcuts';

export class EntreRitesService extends AbstractGameService {
  readonly gameType = 'entre-rites-et-lumieres';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = ENTRE_RITES_GAME.displayName;
  readonly description =
    'Un sept familles illuminé où familles et cartes spéciales s’affrontent.';
  readonly minPlayers = ENTRE_RITES_GAME.minPlayers;
  readonly maxPlayers = ENTRE_RITES_GAME.maxPlayers;

  constructor(
    private readonly setup: EntreRitesSetupService,
    private readonly actions: EntreRitesActionService,
    private readonly presenter: EntreRitesPresenterService,
    private readonly bots: EntreRitesBotService,
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
    return buildEntreRitesShortcuts(ctx);
  }
}






