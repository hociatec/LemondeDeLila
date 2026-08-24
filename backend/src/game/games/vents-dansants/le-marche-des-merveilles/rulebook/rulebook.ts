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
import {
  GOOD_LABELS,
  PROTECT_COST,
  RUMOR_COST,
  WONDER_GOODS,
  copyInventory,
} from '../model/le-marche-des-merveilles-market';
import type {
  LeMarcheDesMerveillesMetadata,
  WonderGood,
} from '../model/le-marche-des-merveilles-state.model';

type MarketActionPayload = {
  good?: string | null;
  direction?: string | null;
  targetPlayerId?: number | null;
};

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state) || state.turn?.currentPlayerId !== playerId) {
    return [];
  }

  const meta = getMeta(state);
  const coins = meta.coins?.[playerId] ?? 0;
  const inventory = copyInventory(meta.inventories?.[playerId]);
  const actions: GameSingleActionDto[] = [{ type: 'pass', payload: {} }];

  for (const good of WONDER_GOODS) {
    const price = meta.prices?.[good] ?? 0;
    if (coins >= price) {
      actions.push({ type: 'buy', payload: { good } });
      actions.push({ type: `buy_${good}`, payload: {} });
    }
    if (inventory[good] > 0) {
      actions.push({ type: 'sell', payload: { good } });
      actions.push({ type: `sell_${good}`, payload: {} });
    }
    if (coins >= RUMOR_COST) {
      actions.push({ type: 'rumor', payload: { good, direction: 'up' } });
      actions.push({ type: 'rumor', payload: { good, direction: 'down' } });
      actions.push({ type: `rumor_up_${good}`, payload: {} });
      actions.push({ type: `rumor_down_${good}`, payload: {} });
    }
  }

  if (coins >= PROTECT_COST && !meta.protectedPlayers?.[playerId]) {
    actions.push({ type: 'protect', payload: {} });
  }

  for (const target of state.players ?? []) {
    const targetId = Number(target?.id ?? 0);
    if (targetId <= 0 || targetId === playerId) continue;
    if (meta.protectedPlayers?.[targetId]) continue;
    const targetInventory = copyInventory(meta.inventories?.[targetId]);
    for (const good of WONDER_GOODS) {
      if (targetInventory[good] > 0) {
        actions.push({
          type: 'steal_deal',
          payload: { targetPlayerId: targetId, good },
        });
        actions.push({ type: 'steal_deal_best', payload: {} });
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
  if (!actorId) {
    throw new GameActorRequiredError();
  }
  if (!isStartedState(state)) {
    throw new GameStateViolationError("La partie n'est pas active.");
  }
  if (state.turn?.currentPlayerId !== actorId) {
    throw new GameTurnViolationError();
  }
  const normalized = normalizeMarketAction(state, action, actorId);
  if (!normalized) {
    throw new GameUnknownActionError(`Action inconnue : ${type}`);
  }

  const meta = getMeta(state);
  const payload = normalized.payload;
  const normalizedType = normalized.type;
  const good = parseGood(payload.good);
  const coins = meta.coins?.[actorId] ?? 0;
  const inventory = copyInventory(meta.inventories?.[actorId]);

  if (
    (normalizedType === 'buy' ||
      normalizedType === 'sell' ||
      normalizedType === 'rumor') &&
    !good
  ) {
    throw new GamePayloadValidationError('Marchandise manquante.');
  }
  if (normalizedType === 'buy' && good && coins < (meta.prices?.[good] ?? 0)) {
    throw new GameActionRejectedError(
      `Pas assez de pieces pour acheter ${GOOD_LABELS[good]}.`,
    );
  }
  if (normalizedType === 'sell' && good && inventory[good] <= 0) {
    throw new GameActionRejectedError(
      `Vous ne possedez pas ${GOOD_LABELS[good]}.`,
    );
  }
  if (normalizedType === 'rumor') {
    const direction = String(payload.direction ?? '').trim();
    if (direction !== 'up' && direction !== 'down') {
      throw new GamePayloadValidationError('Rumeur invalide.');
    }
    if (coins < RUMOR_COST) {
      throw new GameActionRejectedError(
        'Pas assez de pieces pour lancer une rumeur.',
      );
    }
  }
  if (normalizedType === 'protect' && coins < PROTECT_COST) {
    throw new GameActionRejectedError(
      'Pas assez de pieces pour proteger votre etal.',
    );
  }
  if (normalizedType === 'steal_deal') {
    const targetPlayerId = Number(payload.targetPlayerId ?? 0);
    if (!good || targetPlayerId <= 0 || targetPlayerId === actorId) {
      throw new GamePayloadValidationError('Cible invalide.');
    }
    if (meta.protectedPlayers?.[targetPlayerId]) {
      throw new GameActionRejectedError('Cet etal est protege.');
    }
    const targetInventory = copyInventory(meta.inventories?.[targetPlayerId]);
    if (targetInventory[good] <= 0) {
      throw new GameActionRejectedError(
        'La cible ne possede pas cette marchandise.',
      );
    }
  }

  return action;
}

export function parseGood(value: unknown): WonderGood | null {
  const raw =
    typeof value === 'string'
      ? value.trim()
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value).trim()
        : '';
  return (WONDER_GOODS as string[]).includes(raw) ? (raw as WonderGood) : null;
}

export function normalizeMarketAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): { type: string; payload: MarketActionPayload } | null {
  const type = normalizeActionType(action);
  const payload = { ...((action.payload ?? {}) as MarketActionPayload) };
  if (
    type === 'buy' ||
    type === 'sell' ||
    type === 'rumor' ||
    type === 'protect' ||
    type === 'steal_deal' ||
    type === 'pass'
  ) {
    return { type, payload };
  }

  for (const good of WONDER_GOODS) {
    if (type === `buy_${good}`) {
      return { type: 'buy', payload: { good } };
    }
    if (type === `sell_${good}`) {
      return { type: 'sell', payload: { good } };
    }
    if (type === `rumor_up_${good}`) {
      return { type: 'rumor', payload: { good, direction: 'up' } };
    }
    if (type === `rumor_down_${good}`) {
      return { type: 'rumor', payload: { good, direction: 'down' } };
    }
  }

  if (type === 'steal_deal_best' && actorId != null) {
    const best = findBestStealTarget(state, actorId);
    return best ? { type: 'steal_deal', payload: best } : null;
  }

  return null;
}

function findBestStealTarget(
  state: GameStateEntity,
  actorId: number,
): MarketActionPayload | null {
  const meta = getMeta(state);
  let best: { targetPlayerId: number; good: WonderGood; price: number } | null =
    null;
  for (const target of state.players ?? []) {
    const targetPlayerId = Number(target?.id ?? 0);
    if (targetPlayerId <= 0 || targetPlayerId === actorId) continue;
    if (meta.protectedPlayers?.[targetPlayerId]) continue;
    const inventory = copyInventory(meta.inventories?.[targetPlayerId]);
    for (const good of WONDER_GOODS) {
      if (inventory[good] <= 0) continue;
      const price = meta.prices?.[good] ?? 0;
      if (!best || price > best.price) {
        best = { targetPlayerId, good, price };
      }
    }
  }
  return best ? { targetPlayerId: best.targetPlayerId, good: best.good } : null;
}

function getMeta(state: GameStateEntity): LeMarcheDesMerveillesMetadata {
  return (state.metadata ?? {}) as LeMarcheDesMerveillesMetadata;
}
