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
import { FouleesFantastiquesService } from './foulees-fantastiques.service';

/**
 * Compatibilité: ancien id technique `petit-chevaux`.
 * Sert uniquement à ne pas casser d'anciennes tables / historiques.
 */
@Injectable()
export class FouleesFantastiquesLegacyPetitChevauxService
  implements GameRulesAdapter, OnModuleInit
{
  readonly gameType = 'petit-chevaux';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = 'Foulées Fantastiques !';
  readonly description = 'Alias legacy de foulees-fantastiques.';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly delegate: FouleesFantastiquesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return this.delegate.hydrateInitialState(baseState);
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return this.delegate.applyActions(state, actions);
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    return this.delegate.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return this.delegate.validateAction(state, action, actorId);
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.delegate.getBotActions(state, botPlayerId);
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    return this.delegate.exposeState(state);
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.delegate.exposeStateForUser(state, userId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return this.delegate.getShortcuts(ctx);
  }
}
