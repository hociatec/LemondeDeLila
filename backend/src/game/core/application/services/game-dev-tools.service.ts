import { Injectable } from '@nestjs/common';
import type { GameEvent, GameSnapshot } from '../models/game-event.model';
import type { GameStateEntity } from '../models/game-state.model';
import { GameConfigurationError } from '../../domain/errors/game-domain.errors';
import { GameEngineService } from './game-engine.service';
import { GameRegistryService } from './game-registry.service';

export type GameDevToolsInspection = {
  roomId: number;
  gameType: string;
  internalState: GameStateEntity;
  playerView: GameStateEntity | null;
  events: GameEvent[];
  latestSnapshot: GameSnapshot | null;
  runtime: {
    version: number;
    status: string;
    phase: string;
    turn: GameStateEntity['turn'];
    pending: GameStateEntity['pending'];
    rng: { seed: number; counter: number } | null;
  };
  reproduction: {
    gameType: string;
    stateVersion: number | null;
    rulesVersion: string | null;
    seed: number | null;
    commands: Array<{
      commandId: string | null;
      actorId: number | null;
      actionType: string | null;
      payload: unknown;
    }>;
  };
};

/** Explicit internal/debug view; never reused as a player projection. */
@Injectable()
export class GameDevToolsService {
  constructor(
    private readonly engine: GameEngineService,
    private readonly registry: GameRegistryService,
  ) {}

  async inspect(
    roomId: number,
    gameType: string,
    viewerPlayerId: number | null = null,
  ): Promise<GameDevToolsInspection | null> {
    this.assertEnabled();
    const state = await this.engine.exportInternalState(roomId, gameType);
    if (!state) return null;
    const handler = this.registry.getHandler(gameType);
    const events = await this.engine.listEvents(roomId, gameType);
    const engine = this.asRecord((state as { engine?: unknown }).engine);
    return {
      roomId,
      gameType,
      internalState: structuredClone(state),
      playerView: handler
        ? handler.exposeStateForUser(state, viewerPlayerId)
        : null,
      events,
      latestSnapshot: await this.engine.exportLatestSnapshot(roomId, gameType),
      runtime: {
        version: state.version ?? 0,
        status: state.status,
        phase: state.phase,
        turn: structuredClone(state.turn),
        pending: structuredClone(state.pending),
        rng: state.metadata?.rng ? structuredClone(state.metadata.rng) : null,
      },
      reproduction: {
        gameType,
        stateVersion: this.numberOrNull(engine.schemaVersion),
        rulesVersion:
          typeof engine.rulesVersion === 'string' ? engine.rulesVersion : null,
        seed: state.metadata?.rng?.seed ?? null,
        commands: events.flatMap((event) => {
          if (event.type !== 'game.command.accepted') return [];
          const data = this.asRecord(event.data);
          const privateData = this.asRecord(
            event.visibility.kind === 'split'
              ? event.visibility.privateDataByPlayer[String(event.actorId)]
              : null,
          );
          const action = this.asRecord(privateData.action);
          return [
            {
              commandId:
                typeof data.commandId === 'string' ? data.commandId : null,
              actorId: event.actorId,
              actionType:
                typeof data.actionType === 'string' ? data.actionType : null,
              payload: structuredClone(action.payload ?? null),
            },
          ];
        }),
      },
    };
  }

  async restoreAtSequence(
    roomId: number,
    gameType: string,
    sequence: number,
  ): Promise<GameStateEntity> {
    this.assertEnabled();
    if (!Number.isInteger(sequence) || sequence < 0) {
      throw new GameConfigurationError('Séquence de replay invalide');
    }
    const state = await this.engine.replay(roomId, gameType, sequence);
    if (!state)
      throw new GameConfigurationError('Replay de partie introuvable');
    await this.engine.restoreInternalState(roomId, gameType, state);
    return structuredClone(state);
  }

  private assertEnabled(): void {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.GAME_DEVTOOLS_ENABLED !== 'true'
    ) {
      throw new GameConfigurationError(
        'Les Game DevTools sont désactivés en production',
      );
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
