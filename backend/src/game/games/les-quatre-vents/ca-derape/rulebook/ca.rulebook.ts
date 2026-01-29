import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import {
  CA_DERAPE_GAME,
  type CaDerapeActionType,
} from '../definitions/ca.definition';

const ROLL_ALIASES = new Set(['roll', 'ROLL_DICE', 'roll_dice']);

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== playerId) return [];
    if (pending.type === 'draw') {
      return [{ type: 'draw', payload: {} }];
    }
    if (pending.type === 'choose_target') {
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        pending?.data?.targets,
      )
        ? pending.data.targets
        : [];
      return targets.map((t) => ({
        type: 'choose_target',
        payload: { targetPlayerId: t.targetPlayerId },
      }));
    }
    if (pending.type === 'choose_next_player') {
      const ids: number[] = Array.isArray(pending?.data?.playerIds)
        ? pending.data.playerIds
        : [];
      return ids.map((id) => ({
        type: 'choose_next_player',
        payload: { playerId: id },
      }));
    }
    if (pending.type === 'choose_next_delta') {
      const deltas: number[] = Array.isArray(pending?.data?.deltas)
        ? pending.data.deltas
        : [];
      return deltas.map((delta) => ({
        type: 'choose_next_delta',
        payload: { delta },
      }));
    }
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [
    { type: 'roll', payload: {} },
    { type: 'ROLL_DICE', payload: {} },
  ];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = String(action?.type ?? '').trim();
  const normalized: CaDerapeActionType =
    rawType === 'roll_dice' ? 'ROLL_DICE' : (rawType as CaDerapeActionType);

  if (!CA_DERAPE_GAME.actions.includes(normalized)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'ca-derape',
      action: rawType,
      allowedActions: CA_DERAPE_GAME.actions,
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', { gameType: 'ca-derape' });
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'ca-derape',
    });
  }

  const pending: any = state.pending;
  if (pending) {
    if (pending.playerId !== actorId) {
      throw new PlayerActionError('Action réservée à un autre joueur.', {
        gameType: 'ca-derape',
      });
    }
    if (pending.type === 'draw') {
      if (normalized !== 'draw') {
        throw new PlayerActionError('Action non disponible.', {
          gameType: 'ca-derape',
        });
      }
      return { type: 'draw', payload: {} };
    }
    if (pending.type === 'choose_target') {
      if (normalized !== 'choose_target') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'ca-derape',
        });
      }
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        pending?.data?.targets,
      )
        ? pending.data.targets
        : [];
      const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
      if (
        !Number.isFinite(targetPlayerId) ||
        !targets.some((t) => t.targetPlayerId === targetPlayerId)
      ) {
        throw new GameValidationError('Cible invalide.', {
          gameType: 'ca-derape',
          targetPlayerId,
        });
      }
      return { type: 'choose_target', payload: { targetPlayerId } };
    }
    if (pending.type === 'choose_next_player') {
      if (normalized !== 'choose_next_player') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'ca-derape',
        });
      }
      const ids: number[] = Array.isArray(pending?.data?.playerIds)
        ? pending.data.playerIds
        : [];
      const playerId = Number((action.payload as any)?.playerId);
      if (!Number.isFinite(playerId) || !ids.includes(playerId)) {
        throw new GameValidationError('Joueur invalide.', {
          gameType: 'ca-derape',
          playerId,
        });
      }
      return { type: 'choose_next_player', payload: { playerId } };
    }
    if (pending.type === 'choose_next_delta') {
      if (normalized !== 'choose_next_delta') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'ca-derape',
        });
      }
      const deltas: number[] = Array.isArray(pending?.data?.deltas)
        ? pending.data.deltas
        : [];
      const delta = Number((action.payload as any)?.delta);
      if (!Number.isFinite(delta) || !deltas.includes(delta)) {
        throw new GameValidationError('Choix invalide.', {
          gameType: 'ca-derape',
          delta,
        });
      }
      return { type: 'choose_next_delta', payload: { delta } };
    }
    throw new PlayerActionError('Choix invalide.', { gameType: 'ca-derape' });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'ca-derape',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (ROLL_ALIASES.has(rawType) || ROLL_ALIASES.has(rawType.toLowerCase())) {
    return { type: 'roll', payload: {} };
  }
  return { type: normalized, payload: action.payload ?? {} };
}
