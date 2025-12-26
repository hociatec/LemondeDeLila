import type { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
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
} from '../../../../../../common/errors/game-errors';

function normalizeNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function getMeta(state: GameStateEntity): PanierExpressMetadata {
  return (state.metadata ?? {}) as PanierExpressMetadata;
}

function buildExchangeOffers(
  players: any[],
  playerId: number,
  inventoryKey = 'inventory',
): Array<{ targetPlayerId: number; give: string; take: string }> {
  const self = players.find((p) => p && p.id === playerId);
  if (
    !self ||
    !Array.isArray(self[inventoryKey]) ||
    self[inventoryKey].length === 0
  ) {
    return [];
  }

  const offers: Array<{ targetPlayerId: number; give: string; take: string }> =
    [];
  for (const target of players) {
    if (!target || target.id === playerId) continue;
    const targetInv = target[inventoryKey];
    if (!Array.isArray(targetInv) || targetInv.length === 0) continue;
    for (const give of self[inventoryKey]) {
      for (const take of targetInv) {
        offers.push({
          targetPlayerId: target.id,
          give: String(give),
          take: String(take),
        });
      }
    }
  }
  return offers;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if ((state.status || '').toLowerCase() === 'finished') return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];

  const meta = getMeta(state);
  const tiles: PanierExpressTile[] = Array.isArray(meta.tiles) ? meta.tiles : [];
  const pos = meta.positions?.[playerId] ?? 0;
  const tile = tiles[pos] ?? null;

  const pendingQuiz = meta.quiz?.pending?.[playerId];
  const hasPendingQuiz = Boolean(pendingQuiz);
  const pending = state.pending ?? null;
  const hasPendingExchange = Boolean(
    pending && pending.type === 'exchange' && pending.playerId === playerId,
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

          // New system: server maintains a current offer (A/R).
          if (exchangePending?.currentOffer) {
            return [{ type: 'exchange_accept' }, { type: 'exchange_refuse' }];
          }

          // Compat: pending exchange without currentOffer => expose exchange_with.
          const offers = buildExchangeOffers(state.players ?? [], playerId);
          if (offers.length) {
            return offers.map(({ targetPlayerId, give, take }) => ({
              type: 'exchange_with',
              payload: { playerId, targetPlayerId, give, take },
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
  const type = rawType as PanierExpressActionType;
  if (!PANIER_EXPRESS_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType}`, {
      gameType: 'panier-express',
      action: rawType,
      allowedActions: PANIER_EXPRESS_GAME.actions,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'panier-express',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  const payload = action.payload ?? {};

  if (type === 'ROLL_DICE') {
    return { ...action, type: 'roll', payload: {} };
  }

  if (type === 'answer_quiz') {
    const answer = typeof payload.answer === 'string' ? payload.answer.trim() : '';
    if (!answer) {
      throw new GameValidationError('Payload invalide: answer', {
        gameType: 'panier-express',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    return { ...action, type, payload: { answer } };
  }

  if (type === 'exchange_with') {
    const playerId = actorId ?? normalizeNumber(payload.playerId);
    if (playerId == null) {
      throw new GameValidationError('Payload invalide: playerId', {
        gameType: 'panier-express',
        payload,
      });
    }
    const targetPlayerId = normalizeNumber(payload.targetPlayerId);
    if (targetPlayerId == null) {
      throw new GameValidationError('Payload invalide: targetPlayerId', {
        gameType: 'panier-express',
        playerId,
        payload,
      });
    }
    const give = payload.give != null ? String(payload.give) : '';
    const take = payload.take != null ? String(payload.take) : '';
    if (!give || !take) {
      throw new GameValidationError('Payload invalide: give/take', {
        gameType: 'panier-express',
        playerId,
        payload,
      });
    }
    return {
      ...action,
      type,
      payload: { playerId, targetPlayerId, give, take },
    };
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
    return { ...action, type, payload: {} };
  }

  return { ...action, type };
}
