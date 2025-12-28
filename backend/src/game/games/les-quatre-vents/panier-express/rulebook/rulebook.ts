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
  const hasPendingExchange = Boolean(
    pending &&
    pending.type === 'exchange' &&
    pending.playerId === playerId &&
    (pending as any).step !== 'confirm',
  );

  const base: GameSingleActionDto[] = (() => {
    switch (tile?.type) {
      case 'quiz':
        if (hasPendingQuiz) {
          const rawChoices = Array.isArray(pendingQuiz?.choices)
            ? pendingQuiz?.choices
            : pendingQuiz?.answer
              ? [pendingQuiz.answer]
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
        return [{ type: 'roll' }, { type: 'ROLL_DICE' }];

      case 'exchange':
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

          return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
        }
        return [{ type: 'roll' }, { type: 'ROLL_DICE' }];

      default:
        return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
    }
  })();

  if (hasPendingQuiz) {
    return base;
  }
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
  if (type !== 'exchange_accept' && type !== 'exchange_refuse') {
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
    if (
      !pending ||
      pending.type !== 'exchange' ||
      pending.step !== 'confirm' ||
      pending.playerId !== actorId
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
    return { ...action, type, payload: {} };
  }

  return { ...action, type };
}
