import { normalizeLowerActionType } from '../../../../core/application/helpers/action-service.helper';
import { isStartedState } from '../../../../core/application/helpers/rulebook-guard.helper';
import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import {
  GameActorRequiredError,
  GameStateViolationError,
  GameTurnViolationError,
  GameUnknownActionError,
} from '../../../../core/domain/errors/game-domain.errors';
import type { GameSingleActionDto } from '../../../../core/application/models/game-action.model';
import type {
  ZigEtZagMetadata,
  ZigEtZagRoundState,
} from '../model/zig-et-zag-state.model';

function getMeta(state: GameStateEntity): ZigEtZagMetadata {
  return (state.metadata ?? {}) as ZigEtZagMetadata;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  if (getMeta(state).winnerId != null) return [];
  const round = getMeta(state).roundState;
  if (!round) return [];

  const waiting = waitingPlayerIds(round);
  if (!waiting.length || waiting[0] !== playerId) return [];
  return [{ type: 'draw_card', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeLowerActionType(action);
  if (type !== 'draw_card') {
    throw new GameUnknownActionError(`Action inconnue: ${action?.type}`);
  }
  if (actorId == null) {
    throw new GameActorRequiredError('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new GameStateViolationError("La partie n'est pas démarrée.");
  }
  const meta = getMeta(state);
  if (meta.winnerId != null) {
    throw new GameStateViolationError('La partie est terminée.');
  }
  const round = meta.roundState;
  if (!round) {
    throw new GameTurnViolationError();
  }
  const waiting = waitingPlayerIds(round);
  if (!waiting.length || waiting[0] !== actorId) {
    throw new GameTurnViolationError();
  }
  return {
    type: 'draw_card',
    payload: {},
  };
}

function waitingPlayerIds(round: ZigEtZagRoundState): number[] {
  return (round.waitingPlayers ?? [])
    .map((value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value.trim());
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    })
    .filter(
      (value: number | null): value is number => typeof value === 'number',
    );
}
