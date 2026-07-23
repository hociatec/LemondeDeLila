import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { normalizeActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';
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
} from '../model/le-marche-des-merveilles-state.entity';

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
    }
    if (inventory[good] > 0) {
      actions.push({ type: 'sell', payload: { good } });
    }
    if (coins >= RUMOR_COST) {
      actions.push({ type: 'rumor', payload: { good, direction: 'up' } });
      actions.push({ type: 'rumor', payload: { good, direction: 'down' } });
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
    throw new Error('Acteur requis.');
  }
  if (!isStartedState(state)) {
    throw new Error("La partie n'est pas active.");
  }
  if (state.turn?.currentPlayerId !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }
  if (
    type !== 'buy' &&
    type !== 'sell' &&
    type !== 'rumor' &&
    type !== 'protect' &&
    type !== 'steal_deal' &&
    type !== 'pass'
  ) {
    throw new Error(`Action inconnue : ${type}`);
  }

  const meta = getMeta(state);
  const payload = (action.payload ?? {}) as MarketActionPayload;
  const good = parseGood(payload.good);
  const coins = meta.coins?.[actorId] ?? 0;
  const inventory = copyInventory(meta.inventories?.[actorId]);

  if ((type === 'buy' || type === 'sell' || type === 'rumor') && !good) {
    throw new Error('Marchandise manquante.');
  }
  if (type === 'buy' && good && coins < (meta.prices?.[good] ?? 0)) {
    throw new Error(`Pas assez de pieces pour acheter ${GOOD_LABELS[good]}.`);
  }
  if (type === 'sell' && good && inventory[good] <= 0) {
    throw new Error(`Vous ne possedez pas ${GOOD_LABELS[good]}.`);
  }
  if (type === 'rumor') {
    const direction = String(payload.direction ?? '').trim();
    if (direction !== 'up' && direction !== 'down') {
      throw new Error('Rumeur invalide.');
    }
    if (coins < RUMOR_COST) {
      throw new Error('Pas assez de pieces pour lancer une rumeur.');
    }
  }
  if (type === 'protect' && coins < PROTECT_COST) {
    throw new Error('Pas assez de pieces pour proteger votre etal.');
  }
  if (type === 'steal_deal') {
    const targetPlayerId = Number(payload.targetPlayerId ?? 0);
    if (!good || targetPlayerId <= 0 || targetPlayerId === actorId) {
      throw new Error('Cible invalide.');
    }
    if (meta.protectedPlayers?.[targetPlayerId]) {
      throw new Error('Cet etal est protege.');
    }
    const targetInventory = copyInventory(meta.inventories?.[targetPlayerId]);
    if (targetInventory[good] <= 0) {
      throw new Error('La cible ne possede pas cette marchandise.');
    }
  }

  return action;
}

export function parseGood(value: unknown): WonderGood | null {
  const raw = String(value ?? '').trim();
  return (WONDER_GOODS as string[]).includes(raw) ? (raw as WonderGood) : null;
}

function getMeta(state: GameStateEntity): LeMarcheDesMerveillesMetadata {
  return (state.metadata ?? {}) as LeMarcheDesMerveillesMetadata;
}
