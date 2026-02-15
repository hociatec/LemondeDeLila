import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { AbsurdissimesMetadata } from '../model/les-absurdissimes-state.entity';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

type AbsurdissimesActionType = 'play_card' | 'judge_pick';

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
    .map((player) => player!.id);
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
    throw new Error(`Action inconnue: ${type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error('La partie n\'est pas dÃ©marrÃ©e.');
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }
  const meta = getMeta(state);
  if (meta.winnerId != null) {
    throw new Error('La partie est terminÃ©e.');
  }
  const payload = (action.payload ?? {}) as AbsurdissimesActionPayload;

  if (type === 'play_card') {
    if (meta.roundStage !== 'play') {
      throw new Error('Vous ne pouvez pas jouer une carte maintenant.');
    }
    const remaining = meta.remainingPlayers ?? getPlayerIds(state.players);
    if (!remaining.includes(actorId)) {
      throw new Error('Vous avez dÃ©jÃ  jouÃ© cette manche.');
    }
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
      throw new Error('Carte invalide.');
    }
    const hand = meta.blackHands?.[actorId] ?? [];
    if (!hand.includes(cardId)) {
      throw new Error('Vous ne possÃ©dez pas cette carte.');
    }
    return { type: 'play_card', payload: { cardId } };
  }

  if (meta.roundStage !== 'judge') {
    throw new Error('Vous ne pouvez pas choisir de gagnant maintenant.');
  }
  const judgeId = getJudgeId(state, meta);
  if (judgeId !== actorId) {
    throw new Error('Seul le juge peut choisir un gagnant.');
  }
  const winnerId =
    typeof payload.winnerId === 'number' ? payload.winnerId : null;
  if (winnerId == null) {
    throw new Error('SÃ©lection de gagnant invalide.');
  }
  const submissions = meta.submissions ?? {};
  if (!(winnerId in submissions)) {
    throw new Error('Aucune proposition pour ce joueur.');
  }
  return { type: 'judge_pick', payload: { winnerId } };
}



