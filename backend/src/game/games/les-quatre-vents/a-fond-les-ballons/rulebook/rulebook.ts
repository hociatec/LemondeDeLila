import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  isRollActionType,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import {
  requiredInt,
  requiredString,
} from '../../../../core/helpers/payload-validators.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

const GAME_TYPE = 'a-fond-les-ballons';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.type === 'draw' && pending.playerId === playerId) {
      return [{ type: 'draw', payload: {} }];
    }
    if (pending.type === 'choose_pawn' && pending.playerId === playerId) {
      const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      return pawns
        .map((p) => String(p?.id ?? '').trim())
        .filter((id) => id.length > 0)
        .map((id) => ({ type: 'choose_pawn', payload: { pawnId: id } }));
    }
    if (pending.type === 'swap' && pending.playerId === playerId) {
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        pending?.data?.targets,
      )
        ? pending.data.targets
        : [];
      return targets.map((t) => ({
        type: 'swap_choose_target',
        payload: { targetPlayerId: t.targetPlayerId },
      }));
    }
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action);
  const isRoll = isRollActionType(type);
  if (
    !isRoll &&
    type !== 'choose_pawn' &&
    type !== 'swap_choose_target' &&
    type !== 'draw'
  ) {
    throw new GameValidationError(`Action inconnue: ${type}`, {
      gameType: GAME_TYPE,
      action: { type },
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', { gameType: GAME_TYPE });
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: GAME_TYPE,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;

  if (type === 'draw') {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'draw' || pending.playerId !== actorId) {
      throw new PlayerActionError('Action non disponible.', {
        gameType: GAME_TYPE,
      });
    }
    return { type: 'draw', payload: {} };
  }
  if (type === 'choose_pawn') {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn' || pending.playerId !== actorId) {
      throw new PlayerActionError('Action non disponible.', {
        gameType: GAME_TYPE,
      });
    }
    const payload = (action.payload ?? {}) as any;
    const rawPawnId = (() => {
      try {
        return requiredString(
          {
            pawnId: payload.pawnId ?? payload.pawn ?? payload.value,
          },
          'pawnId',
          'Pion invalide.',
        );
      } catch {
        throw new GameValidationError('Pion invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      }
    })();
    const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
      ? pending.data.pawns
      : [];
    const chosen =
      rawPawnId != null
        ? pawns.find((p) => String(p?.id ?? '').trim() === rawPawnId)
        : null;
    if (!chosen) {
      throw new GameValidationError('Pion invalide.', {
        gameType: GAME_TYPE,
        action: { type, payload: action.payload ?? null },
      });
    }
    return { type: 'choose_pawn', payload: { pawnId: chosen.id } };
  }

  if (type === 'swap_choose_target') {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'swap' || pending.playerId !== actorId) {
      throw new PlayerActionError('Action non disponible.', {
        gameType: GAME_TYPE,
      });
    }
    const targets: Array<{ targetPlayerId: number }> = Array.isArray(
      pending?.data?.targets,
    )
      ? pending.data.targets
      : [];
    const targetPlayerId = (() => {
      try {
        return requiredInt(
          action.payload ?? {},
          'targetPlayerId',
          'Cible invalide.',
        );
      } catch {
        throw new GameValidationError('Cible invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      }
    })();
    if (!targets.some((t) => t.targetPlayerId === targetPlayerId)) {
      throw new GameValidationError('Cible invalide.', {
        gameType: GAME_TYPE,
        action: { type, payload: action.payload ?? null },
      });
    }
    return { type: 'swap_choose_target', payload: { targetPlayerId } };
  }

  if (state.pending) {
    throw new PlayerActionError('Action non disponible.', {
      gameType: GAME_TYPE,
    });
  }
  if (current !== actorId) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: GAME_TYPE,
    });
  }
  return { type: 'roll', payload: {} };
}




