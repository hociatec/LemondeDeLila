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
import { LeMarcheDesMerveillesActionService } from './le-marche-des-merveilles-action.service';
import { LeMarcheDesMerveillesBotService } from './le-marche-des-merveilles-bot.service';
import { LE_MARCHE_DES_MERVEILLES_GAME } from '../../definitions/game.definition';
import { LeMarcheDesMerveillesPresenterService } from './le-marche-des-merveilles-presenter.service';
import * as Rulebook from '../../rulebook/rulebook';
import { LeMarcheDesMerveillesSetupService } from './le-marche-des-merveilles-setup.service';
import { buildLeMarcheDesMerveillesShortcuts } from '../../le-marche-des-merveilles.shortcuts';

export class LeMarcheDesMerveillesService extends AbstractGameService {
  readonly gameType = 'le-marche-des-merveilles';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = LE_MARCHE_DES_MERVEILLES_GAME.displayName;
  readonly description =
    'Achetez, vendez, lancez des rumeurs et protegez votre etal pour devenir la plus grande fortune du marche.';
  readonly minPlayers = LE_MARCHE_DES_MERVEILLES_GAME.minPlayers;
  readonly maxPlayers = LE_MARCHE_DES_MERVEILLES_GAME.maxPlayers;

  constructor(
    private readonly setup: LeMarcheDesMerveillesSetupService,
    private readonly actions: LeMarcheDesMerveillesActionService,
    private readonly presenter: LeMarcheDesMerveillesPresenterService,
    private readonly bots: LeMarcheDesMerveillesBotService,
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
    return buildLeMarcheDesMerveillesShortcuts(ctx);
  }
}






