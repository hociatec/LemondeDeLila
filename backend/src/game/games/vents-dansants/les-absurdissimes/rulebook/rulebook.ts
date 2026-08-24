import { normalizeActionType } from '../../../../application/helpers/action-service.helper';
import { isStartedState } from '../../../../application/helpers/rulebook-guard.helper';
import type { GameStateEntity } from '../../../../application/models/game-state.model';
import {
  GameActorRequiredError,
  GameActionRejectedError,
  GamePayloadValidationError,
  GameStateViolationError,
  GameTurnViolationError,
  GameUnknownActionError,
} from '../../../../domain/errors/game-domain.errors';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import type { AbsurdissimesMetadata } from '../model/les-absurdissimes-state.model';

type AbsurdissimesActionPayload = {
  cardId?: string | null;
  winnerId?: number | null;
};

function getMeta(state: GameStateEntity): AbsurdissimesMetadata {
  return (state.metadata ?? {}) as AbsurdissimesMetadata;
}

function getPlayerIds(players?: GameStateEntity['players']): number[] {
  return (Array.isArray(players) ? players : [])
    .filter((player) => typeof player?.id === 'number')
    .map((player) => player.id);
}

export function getJudgeId(
  state: GameStateEntity,
  meta: AbsurdissimesMetadata,
): number | null {
  const players = getPlayerIds(state.players);
  if (!players.length) return null;
  const index = meta.judgeIndex % players.length;
  return players[index] ?? players[0] ?? null;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const meta = getMeta(state);
  if (meta.winnerId != null) return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];

  const stage = meta.roundStage;
  if (stage === 'play') {
    const remaining = meta.remainingPlayers ?? getPlayerIds(state.players);
    if (!remaining.includes(playerId)) return [];
    const hand = meta.blackHands?.[playerId] ?? [];
    return hand.map((cardId) => ({
      type: 'play_card',
      payload: { cardId },
    }));
  }

  if (stage === 'judge') {
    const judgeId = getJudgeId(state, meta);
    if (judgeId !== playerId) return [];
    const submissions = meta.submissions ?? {};
    return Object.keys(submissions).map((key) => ({
      type: 'judge_pick',
      payload: { winnerId: Number(key) },
    }));
  }

  return [];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action);
  if (type !== 'play_card' && type !== 'judge_pick') {
    throw new GameUnknownActionError(`Action inconnue: ${type}`);
  }
  if (actorId == null) {
    throw new GameActorRequiredError('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new GameStateViolationError("La partie n'est pas démarrée.");
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new GameTurnViolationError();
  }
  const meta = getMeta(state);
  if (meta.winnerId != null) {
    throw new GameStateViolationError('La partie est terminée.');
  }
  const payload = (action.payload ?? {}) as AbsurdissimesActionPayload;

  if (type === 'play_card') {
    if (meta.roundStage !== 'play') {
      throw new GameActionRejectedError(
        'Vous ne pouvez pas jouer une carte maintenant.',
      );
    }
    const remaining = meta.remainingPlayers ?? getPlayerIds(state.players);
    if (!remaining.includes(actorId)) {
      throw new GameActionRejectedError(
        'Vous avez déjà joué cette manche.',
      );
    }
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
      throw new GamePayloadValidationError('Carte invalide.');
    }
    const hand = meta.blackHands?.[actorId] ?? [];
    if (!hand.includes(cardId)) {
      throw new GameActionRejectedError('Vous ne possédez pas cette carte.');
    }
    return { type: 'play_card', payload: { cardId } };
  }

  if (meta.roundStage !== 'judge') {
    throw new GameActionRejectedError(
      'Vous ne pouvez pas choisir de gagnant maintenant.',
    );
  }
  const judgeId = getJudgeId(state, meta);
  if (judgeId !== actorId) {
    throw new GameActionRejectedError('Seul le juge peut choisir un gagnant.');
  }
  const winnerId =
    typeof payload.winnerId === 'number' ? payload.winnerId : null;
  if (winnerId == null) {
    throw new GamePayloadValidationError('Sélection de gagnant invalide.');
  }
  const submissions = meta.submissions ?? {};
  if (!(winnerId in submissions)) {
    throw new GameActionRejectedError('Aucune proposition pour ce joueur.');
  }
  return { type: 'judge_pick', payload: { winnerId } };
}
