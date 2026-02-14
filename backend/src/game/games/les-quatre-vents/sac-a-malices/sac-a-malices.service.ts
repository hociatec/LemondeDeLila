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
import { SAC_A_MALICES_GAME } from './definitions/sac-a-malices.definition';
import { SacAMalicesSetupService } from './setup/sac-a-malices-setup.service';
import { SacAMalicesActionService } from './actions/sac-a-malices-action.service';
import { SacAMalicesPresenterService } from './presenter/sac-a-malices-presenter.service';
import { SacAMalicesBotService } from './bots/sac-a-malices-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildSacAMalicesShortcuts } from './sac-a-malices.shortcuts';

@Injectable()
export class SacAMalicesService extends AbstractGameService {
  readonly gameType = 'sac-a-malices';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = SAC_A_MALICES_GAME.displayName;
  readonly description = 'Monopoly Dijon (Chouette et Fortune).';
  readonly minPlayers = SAC_A_MALICES_GAME.minPlayers;
  readonly maxPlayers = SAC_A_MALICES_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: SacAMalicesSetupService,
    private readonly actions: SacAMalicesActionService,
    private readonly presenter: SacAMalicesPresenterService,
    private readonly bots: SacAMalicesBotService,
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

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildSacAMalicesShortcuts(ctx);
  }
}

