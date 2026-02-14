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
import { LaParadeSucreeActionService } from './actions/la-parade-sucree-action.service';
import { LaParadeSucreePresenterService } from './presenter/la-parade-sucree-presenter.service';
import { LaParadeSucreeSetupService } from './setup/la-parade-sucree-setup.service';
import { LaParadeSucreeBotService } from './bots/la-parade-sucree-bot.service';
import { LA_PARADE_SUCREE_GAME } from './definitions/game.definition';
import { buildLaParadeSucreeShortcuts } from './la-parade-sucree.shortcuts';

@Injectable()
export class LaParadeSucreeService extends AbstractGameService {
  readonly gameType = 'la-parade-sucree';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = LA_PARADE_SUCREE_GAME.displayName;
  readonly description =
    'Posez les cartes dans lordre et collectionnez les friandises des cases spéciales.';
  readonly minPlayers = LA_PARADE_SUCREE_GAME.minPlayers;
  readonly maxPlayers = LA_PARADE_SUCREE_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: LaParadeSucreeSetupService,
    private readonly actions: LaParadeSucreeActionService,
    private readonly presenter: LaParadeSucreePresenterService,
    private readonly bots: LaParadeSucreeBotService,
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
    return buildLaParadeSucreeShortcuts(ctx);
  }
}
