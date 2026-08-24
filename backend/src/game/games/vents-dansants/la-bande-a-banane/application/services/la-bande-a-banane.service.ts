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
import { BandeABananeActionService } from './la-bande-a-banane-action.service';
import { BandeABananePresenterService } from './la-bande-a-banane-presenter.service';
import { BandeABananeSetupService } from './la-bande-a-banane-setup.service';
import { BandeABananeBotService } from './la-bande-a-banane-bot.service';
import { BANDE_A_BANANE_GAME } from '../../definitions/game.definition';
import { buildLaBandeABananeShortcuts } from '../../la-bande-a-banane.shortcuts';

export class BandeABananeService extends AbstractGameService {
  readonly gameType = 'la-bande-a-banane';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = BANDE_A_BANANE_GAME.displayName;
  readonly description =
    'Collectez cinq espèces différentes pour devenir le chef de la Bande à Banane !';
  readonly minPlayers = BANDE_A_BANANE_GAME.minPlayers;
  readonly maxPlayers = BANDE_A_BANANE_GAME.maxPlayers;

  constructor(
    private readonly setup: BandeABananeSetupService,
    private readonly actions: BandeABananeActionService,
    private readonly presenter: BandeABananePresenterService,
    private readonly bots: BandeABananeBotService,
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
    return buildLaBandeABananeShortcuts(ctx);
  }
}






