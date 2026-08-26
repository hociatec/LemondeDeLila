import { Injectable } from '@nestjs/common';
import type { GameRuntime } from '../contracts/game-runtime.interface';
import type { GameSingleActionDto } from '../models/game-action.model';
import type { GameStateEntity } from '../models/game-state.model';
import type { GameClock } from '../models/game-execution-context.model';
import { GameActionRejectedError } from '../../domain/errors/game-domain.errors';
import { GameExecutionScopeService } from './game-execution-scope.service';
import { appendPendingGameEvent } from './game-event-log.helper';

@Injectable()
export class GameCommandExecutorService {
  constructor(private readonly execution: GameExecutionScopeService) {}

  execute(input: {
    handler: GameRuntime;
    state: GameStateEntity;
    actions: GameSingleActionDto[];
    actorId: number | null;
    clock?: GameClock;
  }): GameStateEntity {
    let current = this.clone(input.state);
    for (const candidate of input.actions) {
      const actorId = input.actorId ?? this.actorOf(candidate);
      this.ensureActionAllowed(input.handler, current, candidate, actorId);
      const action = input.handler.validateAction(current, candidate, actorId);
      const context = this.execution.create(current, actorId, input.clock);
      appendPendingGameEvent(current, {
        actorId,
        type: 'game.command.accepted',
        data: { action: structuredClone(action) },
        occurredAtMs: context.clock.nowMs(),
      });
      current = this.execution.run(context, () =>
        input.handler.applyActions(current, [action], context),
      );
      this.ensureValidState(current);
    }
    return current;
  }

  private ensureActionAllowed(
    handler: GameRuntime,
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): void {
    if (String(state.status).toLowerCase() === 'finished') {
      throw new GameActionRejectedError('La partie est terminée.');
    }
    if (!handler.validateActor(state, [action], actorId)) {
      throw new GameActionRejectedError('Acteur non autorisé.');
    }
  }

  private ensureValidState(state: GameStateEntity): void {
    if (!state || typeof state !== 'object') {
      throw new GameActionRejectedError(
        'La commande a produit un état invalide.',
      );
    }
    if (!Array.isArray(state.log)) {
      throw new GameActionRejectedError('Le journal de partie est invalide.');
    }
  }

  private actorOf(action: GameSingleActionDto): number | null {
    const actorId = Number(action.meta?.actorId);
    return Number.isFinite(actorId) ? actorId : null;
  }

  private clone(state: GameStateEntity): GameStateEntity {
    return structuredClone(state);
  }
}
