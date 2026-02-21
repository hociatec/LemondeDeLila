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
import { ZigEtZagActionService } from './actions/zig-et-zag-action.service';
import { ZigEtZagPresenterService } from './presenter/zig-et-zag-presenter.service';
import { ZigEtZagSetupService } from './setup/zig-et-zag-setup.service';
import { ZigEtZagBotService } from './bots/zig-et-zag-bot.service';
import { ZIG_ET_ZAG_GAME } from './definitions/game.definition';
import { buildZigEtZagShortcuts } from './zig-et-zag.shortcuts';

@Injectable()
export class ZigEtZagService extends AbstractGameService {
  readonly gameType = 'zig-et-zag';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = ZIG_ET_ZAG_GAME.displayName;
  readonly description =
    'Bataille tendre où chaque duel ramasse les cartes en jeu.';
  readonly minPlayers = ZIG_ET_ZAG_GAME.minPlayers;
  readonly maxPlayers = ZIG_ET_ZAG_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: ZigEtZagSetupService,
    private readonly actions: ZigEtZagActionService,
    private readonly presenter: ZigEtZagPresenterService,
    private readonly bots: ZigEtZagBotService,
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
    return buildZigEtZagShortcuts(ctx);
  }
}
