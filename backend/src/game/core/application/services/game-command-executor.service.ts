import { Injectable, Logger, Optional } from '@nestjs/common';
import type { GameRuntime } from '../contracts/game-runtime.interface';
import type { GameSingleActionDto } from '../models/game-action.model';
import type { GameStateEntity } from '../models/game-state.model';
import type { GameClock } from '../models/game-execution-context.model';
import {
  GameActionRejectedError,
  GameStateConflictError,
} from '../../domain/errors/game-domain.errors';
import { GameExecutionScopeService } from './game-execution-scope.service';
import { appendPendingGameEvent } from './game-event-log.helper';
import {
  commandReceipt,
  normalizeCommandId,
  recordCommandReceipt,
} from '../runtime/actions/game-command-journal';
import { GameEngineMetricsService } from './game-engine-metrics.service';

@Injectable()
export class GameCommandExecutorService {
  private readonly logger = new Logger(GameCommandExecutorService.name);

  constructor(
    private readonly execution: GameExecutionScopeService,
    @Optional() private readonly metrics?: GameEngineMetricsService,
  ) {}

  execute(input: {
    handler: GameRuntime;
    state: GameStateEntity;
    actions: GameSingleActionDto[];
    actorId: number | null;
    clock?: GameClock;
    roomId?: number;
  }): GameStateEntity {
    let current = this.clone(input.state);
    for (const candidate of input.actions) {
      const commandId = normalizeCommandId(candidate.meta?.commandId);
      if (commandId && commandReceipt(current, commandId)) continue;
      const startedAtMs = Date.now();
      const actorId = input.actorId ?? this.actorOf(candidate);
      try {
        this.ensureClientVersion(current, candidate.meta?.knownVersion);
        this.ensureActionAllowed(input.handler, current, candidate, actorId);
        const action = input.handler.validateAction(
          current,
          candidate,
          actorId,
        );
        const context = this.execution.create(
          current,
          actorId,
          input.clock,
          commandId,
        );
        appendPendingGameEvent(current, {
          actorId,
          type: 'game.command.accepted',
          data: {
            actionType: action.type,
            ...(commandId ? { commandId } : {}),
          },
          visibility:
            actorId == null
              ? { kind: 'internal' }
              : {
                  kind: 'split',
                  privateDataByPlayer: {
                    [String(actorId)]: { action: structuredClone(action) },
                  },
                },
          occurredAtMs: context.clock.nowMs(),
        });
        current = this.execution.run(context, () =>
          input.handler.applyActions(current, [action], context),
        );
        if (commandId) {
          recordCommandReceipt(current, {
            commandId,
            actorId,
            actionType: action.type,
            acceptedAtMs: context.clock.nowMs(),
            resultVersion: (current.version ?? 0) + 1,
          });
        }
        this.ensureValidState(current);
        const durationMs = Date.now() - startedAtMs;
        this.metrics?.recordCommand(input.handler.gameType, true, durationMs);
        this.logger.log(
          JSON.stringify({
            event: 'game.command.resolved',
            roomId: input.roomId ?? null,
            gameType: input.handler.gameType,
            commandId,
            actorId,
            actionType: action.type,
            resultVersion: (current.version ?? 0) + 1,
            durationMs,
          }),
        );
      } catch (error) {
        const durationMs = Date.now() - startedAtMs;
        this.metrics?.recordCommand(input.handler.gameType, false, durationMs);
        this.logger.warn(
          JSON.stringify({
            event: 'game.command.rejected',
            roomId: input.roomId ?? null,
            gameType: input.handler.gameType,
            commandId,
            actorId,
            actionType: candidate.type,
            stateVersion: current.version ?? 0,
            errorCode: this.errorCode(error),
            errorDetails: this.errorDetails(error),
            durationMs,
          }),
        );
        throw error;
      }
    }
    return current;
  }

  private errorCode(error: unknown): string {
    return error != null &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
      ? error.code
      : 'INTERNAL_ERROR';
  }

  private errorDetails(error: unknown): Readonly<Record<string, unknown>> {
    return error != null &&
      typeof error === 'object' &&
      'details' in error &&
      error.details != null &&
      typeof error.details === 'object' &&
      !Array.isArray(error.details)
      ? (error.details as Readonly<Record<string, unknown>>)
      : {};
  }

  private ensureClientVersion(
    state: GameStateEntity,
    knownVersion: unknown,
  ): void {
    if (knownVersion == null) return;
    const expected = Number(knownVersion);
    const current = Number(state.version ?? 0);
    if (!Number.isInteger(expected) || expected !== current) {
      throw new GameStateConflictError(
        `Version client obsolète (courante: ${current})`,
      );
    }
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
