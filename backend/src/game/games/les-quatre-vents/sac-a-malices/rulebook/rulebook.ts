import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';

const ALLOWED = new Set(['roll', 'ROLL_DICE', 'roll_dice', 'buy', 'skip_buy']);

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];

  const pending = state.pending as any;
  if (pending?.type === 'buy') {
    if ((pending.playerId ?? null) !== playerId) return [];
    return [{ type: 'buy', payload: {} }, { type: 'skip_buy', payload: {} }];
  }

  if ((state.turn?.currentPlayerId ?? null) !== playerId) return [];
  if (state.pending) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = String(action?.type ?? '').trim();
  const normalized = rawType.toLowerCase();
  if (!ALLOWED.has(rawType) && !ALLOWED.has(normalized)) {
    throw new GameValidationError(
      `Action type not allowed: ${rawType || '(empty)'}`,
      {
        gameType: 'sac-a-malices',
        action: rawType,
        allowedActions: Array.from(ALLOWED),
      },
    );
  }

  const pending = state.pending as any;
  if (pending?.type === 'buy') {
    const pid = pending.playerId ?? null;
    if (pid != null && actorId != null && actorId !== pid) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'sac-a-malices',
        playerId: actorId,
        currentPlayerId: pid,
      });
    }
    if (normalized === 'buy') return { ...action, type: 'buy', payload: {} };
    return { ...action, type: 'skip_buy', payload: {} };
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'sac-a-malices',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (rawType === 'ROLL_DICE' || normalized === 'roll_dice') {
    return { ...action, type: 'roll', payload: {} };
  }
  return { ...action, type: normalized, payload: {} };
}

