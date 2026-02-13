import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import {
  MINUIT_GAME,
  type MinuitActionType,
} from '../definitions/minuit.definition';
import type { MinuitMetadata } from '../model/minuit.types';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const toPlayerId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const n = Number(value.trim());
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const status = String(state.status ?? '').toLowerCase();
  const pawnPending = state.pending as any;
  if (pawnPending && pawnPending.type === 'pick_pawn') {
    if (toPlayerId(pawnPending.playerId) !== playerId) return [];
    const providedChoices = Array.isArray(pawnPending.choices)
      ? pawnPending.choices
      : Array.isArray(pawnPending?.data?.choices)
        ? pawnPending.data.choices
        : [];
    return providedChoices
      .map((choice) => String(choice ?? '').trim())
      .filter((choice) => choice.length > 0)
      .map((choice) => ({
        type: 'pick_pawn',
        payload: { pawn: choice },
      }));
  }
  if (status !== 'started') return [];

  const meta = (state.metadata ?? {}) as any as MinuitMetadata;
  const pendingQuiz = meta.pendingQuiz ?? null;
  if (pendingQuiz) {
    if (toPlayerId(pendingQuiz.playerId) !== playerId) return [];
    return (pendingQuiz.choices ?? []).map((choice) => ({
      type: 'answer_quiz',
      payload: { answer: choice },
    }));
  }

  const activePending = state.pending as any;
  if (activePending) {
    if (toPlayerId(activePending.playerId) !== playerId) return [];
    if (activePending.type === 'draw') {
      return [{ type: 'draw', payload: {} }];
    }
    if (activePending.type === 'choose_target') {
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        activePending?.data?.targets,
      )
        ? activePending.data.targets
        : [];
      return targets.map((t) => ({
        type: 'choose_target',
        payload: { targetPlayerId: t.targetPlayerId },
      }));
    }
    return [];
  }

  const current = toPlayerId(state.turn?.currentPlayerId ?? null);
  if (current !== playerId) return [];
  return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const toPlayerId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const n = Number(value.trim());
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const rawType = String(action?.type ?? '').trim();
  const type = (
    rawType === 'roll_dice' ? 'ROLL_DICE' : rawType
  ) as MinuitActionType;
  if (!MINUIT_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'en-attendant-minuit',
      action: rawType,
      allowedActions: MINUIT_GAME.actions,
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'en-attendant-minuit',
    });
  }

  const pickPawnPending = state.pending as any;
  if (pickPawnPending && pickPawnPending.type === 'pick_pawn') {
    if (toPlayerId(pickPawnPending.playerId) !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'en-attendant-minuit',
      });
    }
    if (type !== 'pick_pawn') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'en-attendant-minuit',
      });
    }
    const providedChoices = Array.isArray(pickPawnPending.choices)
      ? pickPawnPending.choices
      : Array.isArray(pickPawnPending?.data?.choices)
        ? pickPawnPending.data.choices
        : [];
    const normalizedChoices = new Set(
      providedChoices.map((choice) => String(choice ?? '').trim()),
    );
    const requestedPawn = String((action.payload as any)?.pawn ?? '').trim();
    if (!requestedPawn || !normalizedChoices.has(requestedPawn)) {
      throw new GameValidationError('Choix de pion invalide.', {
        gameType: 'en-attendant-minuit',
        pawn: requestedPawn,
      });
    }
    return { type: 'pick_pawn', payload: { pawn: requestedPawn } };
  }

  if (String(state.status ?? '').toLowerCase() !== 'started') {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'en-attendant-minuit',
    });
  }

  const meta = (state.metadata ?? {}) as any as MinuitMetadata;
  if (meta.pendingQuiz) {
    if (type !== 'answer_quiz') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'en-attendant-minuit',
        action: type,
      });
    }
    if (toPlayerId(meta.pendingQuiz.playerId) !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'en-attendant-minuit',
        expectedPlayerId: meta.pendingQuiz.playerId,
      });
    }
    const answer = String((action.payload as any)?.answer ?? '').trim();
    if (!answer) {
      throw new GameValidationError('Payload invalide: answer', {
        gameType: 'en-attendant-minuit',
        payload: action.payload,
      });
    }
    return { type: 'answer_quiz', payload: { answer } };
  }

  const actionPending = state.pending as any;
  if (actionPending) {
    if (toPlayerId(actionPending.playerId) !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'en-attendant-minuit',
      });
    }
    if (actionPending.type === 'draw') {
      if (type !== 'draw') {
        throw new PlayerActionError('Action non disponible.', {
          gameType: 'en-attendant-minuit',
          action: type,
        });
      }
      return { type: 'draw', payload: {} };
    }
    if (actionPending.type === 'choose_target') {
      if (type !== 'choose_target') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'en-attendant-minuit',
        });
      }
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        actionPending?.data?.targets,
      )
        ? actionPending.data.targets
        : [];
      const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
      if (
        !Number.isFinite(targetPlayerId) ||
        !targets.some((t) => t.targetPlayerId === targetPlayerId)
      ) {
        throw new GameValidationError('Cible invalide.', {
          gameType: 'en-attendant-minuit',
          targetPlayerId,
        });
      }
      return { type: 'choose_target', payload: { targetPlayerId } };
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: 'en-attendant-minuit',
    });
  }

  const current = toPlayerId(state.turn?.currentPlayerId ?? null);
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'en-attendant-minuit',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'ROLL_DICE') return { type: 'roll', payload: {} };
  return { type, payload: action.payload ?? {} };
}
