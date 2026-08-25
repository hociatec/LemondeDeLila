import { normalizeActionType } from '../../../../core/application/helpers/action-service.helper';
import { isStartedState } from '../../../../core/application/helpers/rulebook-guard.helper';
import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import {
  GameActorRequiredError,
  GameActionRejectedError,
  GamePayloadValidationError,
  GameStateViolationError,
  GameTurnViolationError,
  GameUnknownActionError,
} from '../../../../core/domain/errors/game-domain.errors';
import type { GameSingleActionDto } from '../../../../core/application/models/game-action.model';
import type { NawakMetadata } from '../model/nawak-state.model';

type NawakActionPayload = {
  answerIndex?: number | null;
  targetPlayerId?: number | null;
};

function getMeta(state: GameStateEntity): NawakMetadata {
  return (state.metadata ?? {}) as NawakMetadata;
}

function getPlayerIds(players?: GameStateEntity['players']): number[] {
  return (Array.isArray(players) ? players : [])
    .filter((player) => typeof player?.id === 'number')
    .map((player) => player.id);
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
  const actions: GameSingleActionDto[] = [];
  if (meta.roundStage === 'choose') {
    const submissions = meta.submissions ?? {};
    if (submissions[playerId] == null && meta.currentChallenge?.answers) {
      for (
        let index = 0;
        index < meta.currentChallenge.answers.length;
        index += 1
      ) {
        actions.push({
          type: 'choose_answer',
          payload: { answerIndex: index },
        });
      }
    }
  } else if (meta.roundStage === 'vote') {
    const votes = meta.votes ?? {};
    if (votes[playerId] == null) {
      const submissions = meta.submissions ?? {};
      const targets = getPlayerIds(state.players).filter(
        (pid) => pid !== playerId && submissions[pid] != null,
      );
      for (const target of targets) {
        actions.push({
          type: 'vote_answer',
          payload: { targetPlayerId: target },
        });
      }
    }
  }
  return actions;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action);
  if (type !== 'choose_answer' && type !== 'vote_answer') {
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

  const payload = (action.payload ?? {}) as NawakActionPayload;
  if (type === 'choose_answer') {
    if (meta.roundStage !== 'choose') {
      throw new GameActionRejectedError('Vous ne pouvez pas choisir maintenant.');
    }
    const answerIndex =
      typeof payload.answerIndex === 'number' ? payload.answerIndex : null;
    if (answerIndex == null || answerIndex < 0 || answerIndex >= 3) {
      throw new GamePayloadValidationError('Réponse invalide.');
    }
    const submissions = meta.submissions ?? {};
    if (submissions[actorId] != null) {
      throw new GameActionRejectedError('Vous avez déjà choisi une réponse.');
    }
    return { type: 'choose_answer', payload: { answerIndex } };
  }

  if (meta.roundStage !== 'vote') {
    throw new GameActionRejectedError('Vous ne pouvez pas voter maintenant.');
  }
  const targetPlayerId =
    typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
  if (targetPlayerId == null || targetPlayerId === actorId) {
    throw new GamePayloadValidationError('Cible de vote invalide.');
  }
  const submissions = meta.submissions ?? {};
  if (submissions[targetPlayerId] == null) {
    throw new GameActionRejectedError("La cible n'a pas soumis de réponse.");
  }
  const votes = meta.votes ?? {};
  if (votes[actorId] != null) {
    throw new GameActionRejectedError('Vous avez déjà voté.');
  }

  return { type: 'vote_answer', payload: { targetPlayerId } };
}
