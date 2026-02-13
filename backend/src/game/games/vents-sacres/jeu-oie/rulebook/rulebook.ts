import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';

const ALLOWED = new Set(['roll', 'ROLL_DICE', 'roll_dice', 'choose_pawn']);

function samePlayerId(a: unknown, b: unknown): boolean {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];

  const pending = state.pending as any;
  if (pending) {
    if (
      pending.type === 'choose_pawn' &&
      samePlayerId(pending.playerId, playerId)
    ) {
      const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      return pawns
        .map((p) => String(p?.id ?? '').trim())
        .filter((id) => id.length > 0)
        .map((id) => ({ type: 'choose_pawn', payload: { pawnId: id } }));
    }
    return [];
  }

  if (!samePlayerId(state.turn?.currentPlayerId ?? null, playerId)) return [];
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
        gameType: 'jeu-oie',
        action: rawType,
        allowedActions: Array.from(ALLOWED),
      },
    );
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new GameValidationError("La partie n'est pas demarree.", {
      gameType: 'jeu-oie',
      action: rawType,
    });
  }

  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', { gameType: 'jeu-oie' });
  }

  const pending = state.pending as any;
  if (pending) {
    if (
      pending.type === 'choose_pawn' &&
      samePlayerId(pending.playerId, actorId)
    ) {
      if (normalized !== 'choose_pawn') {
        throw new PlayerActionError(
          'Action indisponible (choix de pion requis).',
          { gameType: 'jeu-oie', playerId: actorId },
        );
      }
      const payload = (action.payload ?? {}) as any;
      const rawPawn = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
      const value = String(rawPawn ?? '').trim();
      const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      const chosen = pawns.find((p) => String(p?.id ?? '').trim() === value);
      if (!chosen) {
        throw new PlayerActionError('Pion invalide.', {
          gameType: 'jeu-oie',
          playerId: actorId,
        });
      }
      return { type: 'choose_pawn', payload: { pawnId: value } };
    }
    throw new PlayerActionError('Action indisponible (choix en attente).', {
      gameType: 'jeu-oie',
      playerId: actorId,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (!samePlayerId(current, actorId)) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'jeu-oie',
      playerId: actorId,
      currentPlayerId: current as any,
    });
  }

  if (rawType === 'ROLL_DICE' || normalized === 'roll_dice') {
    return { ...action, type: 'roll', payload: {} };
  }
  return { ...action, type: 'roll', payload: {} };
}
