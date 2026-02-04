import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import * as Rulebook from './rulebook/rulebook';
import { AbsurdissimesActionService } from './actions/les-absurdissimes-action.service';
import { AbsurdissimesBotService } from './bots/les-absurdissimes-bot.service';
import { AbsurdissimesPresenterService } from './presenter/les-absurdissimes-presenter.service';
import { AbsurdissimesSetupService } from './setup/les-absurdissimes-setup.service';
import { ABSURDISSIMES_GAME } from './definitions/game.definition';

@Injectable()
export class LesAbsurdissimesService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = ABSURDISSIMES_GAME.id;
  readonly category = 'Cartes';
  readonly subcategory = 'VentsDansants';
  readonly displayName = ABSURDISSIMES_GAME.displayName;
  readonly description =
    'Proposez les réponses les plus absurdes et convainquez le juge pour remporter la manche.';
  readonly minPlayers = ABSURDISSIMES_GAME.minPlayers;
  readonly maxPlayers = ABSURDISSIMES_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: AbsurdissimesSetupService,
    private readonly actions: AbsurdissimesActionService,
    private readonly presenter: AbsurdissimesPresenterService,
    private readonly bots: AbsurdissimesBotService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
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
}
