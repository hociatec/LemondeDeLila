import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import * as Rulebook from './rulebook/rulebook';
import { CatPattesActionService } from './actions/cat-pattes-action.service';
import { CatPattesPresenterService } from './presenter/cat-pattes-presenter.service';
import { CatPattesSetupService } from './setup/cat-pattes-setup.service';
import { CatPattesBotService } from './bots/cat-pattes-bot.service';
import { CAT_PATTES_GAME } from './definitions/game.definition';

@Injectable()
export class CatPattesService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'cat-pattes';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = CAT_PATTES_GAME.displayName;
  readonly description = 'Course féline jusqu’à 1 000 pattes.';
  readonly minPlayers = CAT_PATTES_GAME.minPlayers;
  readonly maxPlayers = CAT_PATTES_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: CatPattesSetupService,
    private readonly actions: CatPattesActionService,
    private readonly presenter: CatPattesPresenterService,
    private readonly bots: CatPattesBotService,
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
    return this.bots.getBotActions();
  }
}
