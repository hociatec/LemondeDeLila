import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
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
  const rawPending = state.pending as any;
  const pendingPlayerId = normalizeNumber(rawPending?.playerId);
  if (
    rawPending &&
    rawPending.blocking &&
    pendingPlayerId != null &&
    pendingPlayerId !== playerId
  ) {
    // Une action bloquante est en attente pour un autre joueur : personne d'autre ne peut jouer.
    return [];
  }
  if (
    rawPending &&
    rawPending.type === 'pick' &&
    pendingPlayerId != null &&
    pendingPlayerId === playerId
  ) {
    const choices = Array.isArray(rawPending.choices) ? rawPending.choices : [];
    return choices.map((_, index: number) => ({
      type: 'pick_choice',
      payload: { index },
    }));
  }
  if (
    rawPending &&
    rawPending.type === 'exchange' &&
    rawPending.step === 'confirm' &&
    rawPending.playerId === playerId
  ) {
    return [{ type: 'exchange_accept' }, { type: 'exchange_refuse' }];
  }
  if (
    rawPending &&
    rawPending.type === 'exchange' &&
    rawPending.step === 'confirm'
  ) {
    return [];
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
  const pending = state.pending ?? null;
  const pendingPid = normalizeNumber((pending as any)?.playerId);
  const hasPendingExchange = Boolean(
    pending &&
    pending.type === 'exchange' &&
    pendingPid != null &&
    pendingPid === playerId &&
    (pending as any).step !== 'confirm',
  );

  // IMPORTANT: un quiz "pending" peut provenir d'autres mécaniques (ex: échange refusé),
  // pas uniquement d'une case quiz. Tant que le quiz n'est pas résolu, aucune autre action n'est autorisée.
  if (hasPendingQuiz) {
    const rawChoices = Array.isArray((pendingQuiz as any)?.choices)
      ? (pendingQuiz as any).choices
      : (pendingQuiz as any)?.answer
        ? [(pendingQuiz as any).answer]
        : [];
    const choices = rawChoices
      .map((c: any) => String(c))
      .map((c: string) => c.trim())
      .filter((c: string) => c.length > 0);
    return choices.map((answer) => ({
      type: 'answer_quiz',
      payload: { answer },
    }));
  }

  // IMPORTANT: un échange "pending" peut aussi provenir d'une action/carte (pas uniquement d'une case échange).
  // Tant que l'échange n'est pas terminé, aucune autre action n'est autorisée.
  if (hasPendingExchange) {
    const exchangePending = pending as any;

    if (exchangePending?.step === 'choose_target') {
      const targets = Array.isArray(exchangePending.targets)
        ? exchangePending.targets
        : [];
      return targets
        .filter((t: any) => t && typeof t.targetPlayerId === 'number')
        .map((t: any) => ({
          type: 'exchange_choose_target',
          payload: { targetPlayerId: t.targetPlayerId },
        }));
    }

    if (exchangePending?.step === 'choose_give') {
      const choices = Array.isArray(exchangePending.giveChoices)
        ? exchangePending.giveChoices
        : [];
      return choices
        .map((c: any) => String(c))
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0)
        .map((give: string) => ({
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
  const rawType = String(action?.type ?? '').trim();
  const normalizedType = rawType.toLowerCase();
  const type = rawType as PanierExpressActionType;
  const pendingAny = state.pending as any;
  const hasBlockingPending = Boolean(pendingAny?.blocking);
  const pendingPlayerId = normalizeNumber(pendingAny?.playerId);

  if (hasBlockingPending) {
    const allowedWhileBlocking = new Set<string>([
      'pick_choice',
      'exchange_choose_target',
      'exchange_choose_give',
      'exchange_accept',
      'exchange_refuse',
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
      if (normalizedType === 'roll' || normalizedType === 'roll_dice') {
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
    !PANIER_EXPRESS_GAME.actions.includes(normalizedType as any)
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
    type !== 'pick_choice'
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

  if (type === 'ROLL_DICE' || normalizedType === 'roll_dice') {
    return { ...action, type: 'roll', payload: {} };
  }

  if (type === 'pick_choice') {
    const pending = state.pending as any;
    const pid = normalizeNumber(pending?.playerId);
    if (!pending || pending.type !== 'pick' || pid == null || pid !== actorId) {
      throw new PlayerActionError('Aucun choix en attente.', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
      });
    }
    const index = normalizeNumber((payload as any).index);
    const choices = Array.isArray(pending.choices) ? pending.choices : [];
    if (index == null || index < 0 || index >= choices.length) {
      throw new GameValidationError('Payload invalide: index', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    return { ...action, type, payload: { index } };
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
    const give = payload.give != null ? String(payload.give).trim() : '';
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
    const pending = state.pending as any;
    const pid = normalizeNumber(pending?.playerId);
    if (
      !pending ||
      pending.type !== 'exchange' ||
      pending.step !== 'confirm' ||
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
      const pending = state.pending as any;
      if (pending && pending.type === 'exchange') {
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
