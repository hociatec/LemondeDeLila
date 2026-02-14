import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import * as Rulebook from './rulebook/rulebook';
import { BandeABananeActionService } from './actions/la-bande-a-banane-action.service';
import { BandeABananePresenterService } from './presenter/la-bande-a-banane-presenter.service';
import { BandeABananeSetupService } from './setup/la-bande-a-banane-setup.service';
import { BandeABananeBotService } from './bots/la-bande-a-banane-bot.service';
import { BANDE_A_BANANE_GAME } from './definitions/game.definition';
import { buildLaBandeABananeShortcuts } from './la-bande-a-banane.shortcuts';

@Injectable()
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
    registry: GameRegistryService,
    private readonly setup: BandeABananeSetupService,
    private readonly actions: BandeABananeActionService,
    private readonly presenter: BandeABananePresenterService,
    private readonly bots: BandeABananeBotService,
  ) {
    super(registry);
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

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildLaBandeABananeShortcuts(ctx);
  }
}
