import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import * as PetitChevauxRulebook from './rulebook/rulebook';
import { FouleesFantastiquesActionService } from './actions/foulees-fantastiques-action.service';
import { FouleesFantastiquesPhaseService } from './phases/foulees-fantastiques-phase.service';
import { FouleesFantastiquesPresenterService } from './presenter/foulees-fantastiques-presenter.service';
import { FouleesFantastiquesSetupService } from './setup/foulees-fantastiques-setup.service';
import { FOULEES_FANTASTIQUES_GAME } from './definitions/game.definition';
import { FouleesFantastiquesBotService } from './bots/foulees-fantastiques-bot.service';
import { buildFouleesFantastiquesShortcuts } from './foulees-fantastiques.shortcuts';

@Injectable()
export class FouleesFantastiquesService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'foulees-fantastiques';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = FOULEES_FANTASTIQUES_GAME.displayName;
  readonly description = 'le jeu classique des petits chevaux';
  readonly minPlayers = FOULEES_FANTASTIQUES_GAME.minPlayers;
  readonly maxPlayers = FOULEES_FANTASTIQUES_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: FouleesFantastiquesSetupService,
    private readonly actions: FouleesFantastiquesActionService,
    private readonly phases: FouleesFantastiquesPhaseService,
    private readonly presenter: FouleesFantastiquesPresenterService,
    private readonly bots: FouleesFantastiquesBotService,
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
    const next = this.actions.applyActions(state, actions);
    return this.phases.advance(next);
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    return PetitChevauxRulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return PetitChevauxRulebook.validateAction(state, action, actorId);
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    // Fallback (non personnalisé) : aucune action.
    return { ...state, actions: [] };
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildFouleesFantastiquesShortcuts(ctx);
  }
}
