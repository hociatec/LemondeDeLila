import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';

const ALLOWED = new Set([
  'roll',
  'ROLL_DICE',
  'roll_dice',
  'draw',
  'answer_quiz',
  'choose_target',
]);

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending?.type === 'draw') {
    if ((pending.playerId ?? null) !== playerId) return [];
    return [{ type: 'draw', payload: {} }];
  }
  if (pending?.type === 'quiz') {
    if ((pending.playerId ?? null) !== playerId) return [];
    return [{ type: 'answer_quiz', payload: {} }];
  }
  if (pending?.type === 'choose_target') {
    if ((pending.playerId ?? null) !== playerId) return [];
    return [{ type: 'choose_target', payload: {} }];
  }

  if ((state.turn?.currentPlayerId ?? null) !== playerId) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const normalized = rawType.toLowerCase();
  if (!ALLOWED.has(rawType) && !ALLOWED.has(normalized)) {
    throw new GameValidationError(
      `Action type not allowed: ${rawType || '(empty)'}`,
      {
        gameType: 'voyage-en-terre-de-brumes',
        action: rawType,
        allowedActions: Array.from(ALLOWED),
      },
    );
  }

  const pending = state.pending as any;
  if (pending?.type) {
    const pid = pending.playerId ?? null;
    if (pid != null && actorId != null && actorId !== pid) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'voyage-en-terre-de-brumes',
        playerId: actorId,
        currentPlayerId: pid,
      });
    }
    if (pending.type === 'draw') return { ...action, type: 'draw', payload: {} };
    if (pending.type === 'quiz') return action.type === 'answer_quiz'
      ? action
      : { ...action, type: 'answer_quiz' };
    if (pending.type === 'choose_target') return action.type === 'choose_target'
      ? action
      : { ...action, type: 'choose_target' };
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'voyage-en-terre-de-brumes',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (rawType === 'ROLL_DICE' || normalized === 'roll_dice') {
    return { ...action, type: 'roll', payload: {} };
  }
  if (normalized === 'draw') return { ...action, type: 'draw', payload: {} };
  if (normalized === 'answer_quiz') return action;
  if (normalized === 'choose_target') return action;
  return { ...action, type: 'roll', payload: {} };
}




