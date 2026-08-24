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
import { CerclesSacresActionService } from './cercles-sacres-action.service';
import { CerclesSacresPresenterService } from './cercles-sacres-presenter.service';
import { CerclesSacresSetupService } from './cercles-sacres-setup.service';
import { CerclesSacresBotService } from './cercles-sacres-bot.service';
import { CERCLES_SACRES_GAME } from '../../definitions/game.definition';
import { buildCerclesSacresShortcuts } from '../../cercles-sacres.shortcuts';

export class CerclesSacresService extends AbstractGameService {
  readonly gameType = 'cercles-sacres';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = CERCLES_SACRES_GAME.displayName;
  readonly description =
    'Formez trois Cercles Sacrés en alignant six cartes thématiques.';
  readonly minPlayers = CERCLES_SACRES_GAME.minPlayers;
  readonly maxPlayers = CERCLES_SACRES_GAME.maxPlayers;

  constructor(
    private readonly setup: CerclesSacresSetupService,
    private readonly actions: CerclesSacresActionService,
    private readonly presenter: CerclesSacresPresenterService,
    private readonly bots: CerclesSacresBotService,
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
    return buildCerclesSacresShortcuts(ctx);
  }
}
