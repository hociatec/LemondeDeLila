import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  isRollActionType,
  isRollAlias,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import type {
  PanierExpressMetadata,
  PanierExpressTile,
} from '../model/panier-express-state.entity';
import {
  PANIER_EXPRESS_GAME,
  type PanierExpressActionType,
} from '../definitions/game.definition';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import {
  getPendingPawnActionsForPlayer,
  validatePendingPawnActionForActor,
} from '../../../../core/helpers/pawn-pending-rulebook.helper';
import {
  getPendingIndexedChoiceActionsForPlayer,
  validatePendingDrawActionForActor,
  validatePendingIndexedChoiceActionForActor,
} from '../../../../core/helpers/pending-actions-rulebook.helper';

type PendingRecord = Record<string, unknown>;

function normalizeNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function getMeta(state: GameStateEntity): PanierExpressMetadata {
  return (state.metadata ?? {}) as PanierExpressMetadata;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if ((state.status || '').toLowerCase() === 'finished') return [];
  const rawPending = asPendingRecord(state.pending);
  const pendingPlayerId = normalizeNumber(rawPending?.playerId);
  if (
    rawPending &&
    toBoolean(rawPending.blocking) &&
    pendingPlayerId != null &&
    pendingPlayerId !== playerId
  ) {
    // Une action bloquante est en attente pour un autre joueur : personne d'autre ne peut jouer.
    return [];
  }
  if (
    rawPending &&
    validatePendingDrawActionForActor({
      pending: rawPending,
      actorId: playerId,
      actionType: 'draw',
      samePlayer: (left, right) =>
        normalizeNumber(left) === normalizeNumber(right),
    }).ok
  ) {
    return [{ type: 'draw' }];
  }
  if (
    rawPending &&
    toText(rawPending.type) === 'choose_pawn' &&
    pendingPlayerId != null &&
    pendingPlayerId === playerId
  ) {
    return getPendingPawnActionsForPlayer(rawPending, playerId, 'choose_pawn');
  }
  if (
    rawPending &&
    toText(rawPending.type) === 'pick' &&
    pendingPlayerId != null &&
    pendingPlayerId === playerId
  ) {
    return getPendingIndexedChoiceActionsForPlayer(rawPending, playerId, {
      pendingType: 'pick',
      actionType: 'pick_choice',
      payloadIndexKey: 'index',
      choicesContainer: 'root',
      choicesKey: 'choices',
      samePlayer: (left, right) =>
        normalizeNumber(left) === normalizeNumber(right),
    });
  }
  if (
    rawPending &&
    toText(rawPending.type) === 'exchange' &&
    toText(rawPending.step) === 'confirm' &&
    normalizeNumber(rawPending.playerId) === playerId
  ) {
    return [{ type: 'exchange_accept' }, { type: 'exchange_refuse' }];
  }
  if (
    rawPending &&
    toText(rawPending.type) === 'exchange' &&
    toText(rawPending.step) === 'confirm'
  ) {
    return [];
  }
  if (rawPending && toText(rawPending.type) === 'merchant_request') {
    return pendingPlayerId === playerId
      ? [
          { type: 'merchant_request_accept' },
          { type: 'merchant_request_refuse' },
        ]
      : [];
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];

  const meta = getMeta(state);
  const tiles: PanierExpressTile[] = Array.isArray(meta.tiles)
    ? meta.tiles
    : [];
  const pos = meta.positions?.[playerId] ?? 0;
  const tile = tiles[pos] ?? null;

  const pendingQuiz = meta.quiz?.pending?.[playerId];
  const hasPendingQuiz = Boolean(pendingQuiz);
  const pending = asPendingRecord(state.pending);
  const pendingPid = normalizeNumber(pending?.playerId);
  const hasPendingExchange = Boolean(
    pending &&
    toText(pending.type) === 'exchange' &&
    pendingPid != null &&
    pendingPid === playerId &&
    toText(pending.step) !== 'confirm',
  );

  // IMPORTANT: un quiz "pending" peut provenir d'autres mécaniques (ex: échange refusé),
  // pas uniquement d'une case quiz. Tant que le quiz n'est pas résolu, aucune autre action n'est autorisée.
  if (hasPendingQuiz) {
    const quizPending = asRecord(pendingQuiz);
    const rawChoices = Array.isArray(quizPending.choices)
      ? quizPending.choices
      : toText(quizPending.answer)
        ? [quizPending.answer]
        : [];
    const choices = rawChoices
      .map((c) => toText(c).trim())
      .filter((c) => c.length > 0);
    return choices.map((answer) => ({
      type: 'answer_quiz',
      payload: { answer },
    }));
  }

  // IMPORTANT: un échange "pending" peut aussi provenir d'une action/carte (pas uniquement d'une case échange).
  // Tant que l'échange n'est pas terminé, aucune autre action n'est autorisée.
  if (hasPendingExchange) {
    const exchangePending = pending;
    if (!exchangePending) return [];

    if (toText(exchangePending.step) === 'choose_target') {
      const targets = toRecordArray(exchangePending.targets);
      return targets
        .filter((t) => normalizeNumber(t.targetPlayerId) != null)
        .map((t) => ({
          type: 'exchange_choose_target',
          payload: { targetPlayerId: normalizeNumber(t.targetPlayerId) },
        }));
    }

    if (toText(exchangePending.step) === 'choose_give') {
      const choices = toUnknownArray(exchangePending.giveChoices);
      return choices
        .map((c) => toText(c).trim())
        .filter((c) => c.length > 0)
        .map((give) => ({
          type: 'exchange_choose_give',
          payload: { give },
        }));
    }

    // Étape inconnue => ne pas proposer 'roll' (sinon boucle d'erreur "terminer l'échange").
    return [];
  }

  const base: GameSingleActionDto[] = (() => {
    switch (tile?.type) {
      case 'quiz':
        return [{ type: 'roll' }, { type: 'ROLL_DICE' }];

      case 'exchange':
        return [{ type: 'roll' }, { type: 'ROLL_DICE' }];

      default:
        return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
    }
  })();
  return base;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const normalizedType = rawType.toLowerCase();
  const type = rawType as PanierExpressActionType;
  const pendingAny = asPendingRecord(state.pending);
  const hasBlockingPending = toBoolean(pendingAny?.blocking);
  const pendingPlayerId = normalizeNumber(pendingAny?.playerId);

  if (hasBlockingPending) {
    const allowedWhileBlocking = new Set<string>([
      'draw',
      'choose_pawn',
      'pick_choice',
      'exchange_choose_target',
      'exchange_choose_give',
      'exchange_accept',
      'exchange_refuse',
      'merchant_request_accept',
      'merchant_request_refuse',
    ]);
    const isAllowed = allowedWhileBlocking.has(normalizedType);
    if (!isAllowed) {
      if (
        actorId != null &&
        pendingPlayerId != null &&
        actorId !== pendingPlayerId
      ) {
        throw new PlayerActionError('Une action est déjà en attente.', {
          gameType: 'panier-express',
          playerId: actorId,
          currentPlayerId: state.turn?.currentPlayerId ?? null,
        });
      }
      if (isRollActionType(rawType, normalizedType)) {
        if (actorId != null) {
          throw new PlayerActionError(
            "Vous devez d'abord résoudre l'action en attente.",
            {
              gameType: 'panier-express',
              playerId: actorId,
            },
          );
        }
        throw new GameValidationError(
          'Action impossible: une action est en attente.',
          {
            gameType: 'panier-express',
            action: rawType,
          },
        );
      }
    }
  }
  if (
    !PANIER_EXPRESS_GAME.actions.includes(type) &&
    !PANIER_EXPRESS_GAME.actions.includes(
      normalizedType as PanierExpressActionType,
    )
  ) {
    throw new GameValidationError(`Action inconnue: ${rawType}`, {
      gameType: 'panier-express',
      action: rawType,
      allowedActions: PANIER_EXPRESS_GAME.actions,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (
    type !== 'exchange_accept' &&
    type !== 'exchange_refuse' &&
    type !== 'choose_pawn' &&
    type !== 'pick_choice' &&
    type !== 'draw'
  ) {
    if (current != null && actorId != null && actorId !== current) {
      throw new PlayerActionError("Ce n'est pas votre tour.", {
        gameType: 'panier-express',
        playerId: actorId,
        currentPlayerId: current,
      });
    }
  }

  const payload = action.payload ?? {};

  if (isRollAlias(type, normalizedType)) {
    return { ...action, type: 'roll', payload: {} };
  }

  if (type === 'choose_pawn') {
    const pending = asPendingRecord(state.pending);
    const validation = validatePendingPawnActionForActor({
      pending,
      actorId: Number(actorId ?? NaN),
      actionType: type,
      payload,
      pendingType: 'choose_pawn',
    });
    if (!validation.ok && validation.reason === 'not_pending_for_actor') {
      throw new PlayerActionError('Aucun choix en attente.', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
      });
    }
    if (!validation.ok) {
      throw new GameValidationError('Payload invalide: pawnId', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    return validation.action;
  }

  if (type === 'pick_choice') {
    const pending = asPendingRecord(state.pending);
    const validation = validatePendingIndexedChoiceActionForActor({
      pending,
      actorId: Number(actorId ?? NaN),
      actionType: type,
      payload,
      pendingType: 'pick',
      expectedActionType: 'pick_choice',
      payloadIndexKey: 'index',
      choicesContainer: 'root',
      choicesKey: 'choices',
      samePlayer: (left, right) =>
        normalizeNumber(left) === normalizeNumber(right),
    });
    if (!validation.ok && validation.reason === 'not_pending_for_actor') {
      throw new PlayerActionError('Aucun choix en attente.', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
      });
    }
    if (!validation.ok) {
      throw new GameValidationError('Payload invalide: index', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    return validation.action;
  }

  if (type === 'answer_quiz') {
    const answer =
      typeof payload.answer === 'string' ? payload.answer.trim() : '';
    if (!answer) {
      throw new GameValidationError('Payload invalide: answer', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    return { ...action, type, payload: { answer } };
  }

  if (type === 'exchange_choose_target') {
    const targetPlayerId = normalizeNumber(payload.targetPlayerId);
    if (targetPlayerId == null) {
      throw new GameValidationError('Payload invalide: targetPlayerId', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    return { ...action, type, payload: { targetPlayerId } };
  }

  if (type === 'exchange_choose_give') {
    const give = toText(payload.give).trim();
    if (!give) {
      throw new GameValidationError('Payload invalide: give', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    return { ...action, type, payload: { give } };
  }

  if (type === 'exchange_accept' || type === 'exchange_refuse') {
    const pending = asPendingRecord(state.pending);
    const pid = normalizeNumber(pending?.playerId);
    if (
      !pending ||
      toText(pending.type) !== 'exchange' ||
      toText(pending.step) !== 'confirm' ||
      pid == null ||
      pid !== actorId
    ) {
      throw new PlayerActionError('Aucun échange à confirmer.', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
      });
    }
    return { ...action, type, payload: {} };
  }

  if (
    type === 'merchant_request_accept' ||
    type === 'merchant_request_refuse'
  ) {
    const pending = asPendingRecord(state.pending);
    const pid = normalizeNumber(pending?.playerId);
    if (
      !pending ||
      toText(pending.type) !== 'merchant_request' ||
      pid == null ||
      pid !== actorId
    ) {
      throw new PlayerActionError('Aucune demande du marchand en attente.', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
      });
    }
    return { ...action, type, payload: {} };
  }

  if (type === 'draw') {
    const pending = asPendingRecord(state.pending);
    const drawValidation = validatePendingDrawActionForActor({
      pending,
      actorId: Number(actorId ?? NaN),
      actionType: 'draw',
      samePlayer: (left, right) =>
        normalizeNumber(left) === normalizeNumber(right),
    });
    if (!drawValidation.ok) {
      throw new PlayerActionError('Aucune pioche en attente.', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
      });
    }
    return { ...action, type: 'draw', payload: {} };
  }

  if (type === 'skip_turn') {
    const playerId = actorId ?? normalizeNumber(payload.playerId);
    if (playerId == null) {
      throw new GameValidationError('Payload invalide: playerId', {
        gameType: 'panier-express',
        payload,
      });
    }
    return { ...action, type, payload: { playerId } };
  }

  if (type === 'roll') {
    // Anti-triche: ignorer tout payload côté client (ex: roll forcé).
    if (actorId != null) {
      const meta = getMeta(state);
      const pendingQuiz = meta.quiz?.pending?.[actorId];
      if (pendingQuiz) {
        throw new PlayerActionError('Vous devez répondre au quiz.', {
          gameType: 'panier-express',
          playerId: actorId,
        });
      }
      const pending = asPendingRecord(state.pending);
      if (pending && toText(pending.type) === 'exchange') {
        throw new PlayerActionError("Vous devez terminer l'échange en cours.", {
          gameType: 'panier-express',
          playerId: actorId,
        });
      }
    }
    if (hasBlockingPending) {
      if (actorId != null) {
        throw new PlayerActionError(
          "Vous devez d'abord résoudre l'action en attente.",
          {
            gameType: 'panier-express',
            playerId: actorId,
          },
        );
      }
      throw new GameValidationError(
        'Action impossible: une action est en attente.',
        {
          gameType: 'panier-express',
          action: rawType,
        },
      );
    }
    return { ...action, type, payload: {} };
  }

  return { ...action, type };
}

function asPendingRecord(value: unknown): PendingRecord | null {
  if (value == null || typeof value !== 'object') return null;
  return value as PendingRecord;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function toUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      item != null && typeof item === 'object',
  );
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function toBoolean(value: unknown): boolean {
  return value === true;
}
