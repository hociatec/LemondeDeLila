import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import {
  GOOD_LABELS,
  PROTECT_COST,
  RUMOR_COST,
  WONDER_GOODS,
  clampPrice,
  copyInventory,
  inventoryValue,
} from '../model/le-marche-des-merveilles-market';
import type {
  LeMarcheDesMerveillesMetadata,
  WonderGood,
} from '../model/le-marche-des-merveilles-state.entity';
import { normalizeMarketAction, parseGood } from '../rulebook/rulebook';

type MarketActionPayload = {
  good?: string | null;
  direction?: string | null;
  targetPlayerId?: number | null;
};

@Injectable()
export class LeMarcheDesMerveillesActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return applyActionsSequentially(state, actions, (next, action) => {
      const actorId = next.turn?.currentPlayerId ?? null;
      const normalized = normalizeMarketAction(next, action, actorId);
      if (!normalized) return next;
      const type = normalizeActionType({ type: normalized.type });
      const normalizedAction = {
        ...action,
        type: normalized.type,
        payload: normalized.payload,
      };
      return dispatchByActionType(
        type,
        {
          buy: () => this.handleBuy(next, normalizedAction),
          sell: () => this.handleSell(next, normalizedAction),
          rumor: () => this.handleRumor(next, normalizedAction),
          protect: () => this.handleProtect(next),
          steal_deal: () => this.handleStealDeal(next, normalizedAction),
          pass: () => this.finishAction(next, 'observe le marche.'),
        },
        () => next,
      );
    });
  }

  private handleBuy(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const playerId = state.turn?.currentPlayerId ?? null;
    const good = parseGood(((action.payload ?? {}) as MarketActionPayload).good);
    if (playerId == null || !good) return state;

    const meta = this.getMeta(state);
    const price = meta.prices[good] ?? 0;
    const coins = { ...(meta.coins ?? {}) };
    if ((coins[playerId] ?? 0) < price) return state;

    const inventories = { ...(meta.inventories ?? {}) };
    const inventory = copyInventory(inventories[playerId]);
    coins[playerId] = (coins[playerId] ?? 0) - price;
    inventory[good] += 1;
    inventories[playerId] = inventory;

    const prices = { ...meta.prices, [good]: clampPrice(price + 1) };
    const label = GOOD_LABELS[good];
    let next = this.setMeta(state, {
      ...meta,
      coins,
      inventories,
      prices,
      lastMarketEvent: `${label} monte a ${prices[good]}.`,
    });
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} achete ${label} pour ${price} pieces.`,
    );
    return this.finishAction(next);
  }

  private handleSell(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const playerId = state.turn?.currentPlayerId ?? null;
    const good = parseGood(((action.payload ?? {}) as MarketActionPayload).good);
    if (playerId == null || !good) return state;

    const meta = this.getMeta(state);
    const inventories = { ...(meta.inventories ?? {}) };
    const inventory = copyInventory(inventories[playerId]);
    if (inventory[good] <= 0) return state;

    const price = meta.prices[good] ?? 0;
    const coins = { ...(meta.coins ?? {}) };
    inventory[good] -= 1;
    inventories[playerId] = inventory;
    coins[playerId] = (coins[playerId] ?? 0) + price;

    const prices = { ...meta.prices, [good]: clampPrice(price - 1) };
    const label = GOOD_LABELS[good];
    let next = this.setMeta(state, {
      ...meta,
      coins,
      inventories,
      prices,
      lastMarketEvent: `${label} baisse a ${prices[good]}.`,
    });
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} vend ${label} pour ${price} pieces.`,
    );
    return this.finishAction(next);
  }

  private handleRumor(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const playerId = state.turn?.currentPlayerId ?? null;
    const payload = (action.payload ?? {}) as MarketActionPayload;
    const good = parseGood(payload.good);
    const direction = String(payload.direction ?? '').trim();
    if (playerId == null || !good || (direction !== 'up' && direction !== 'down')) {
      return state;
    }

    const meta = this.getMeta(state);
    const coins = { ...(meta.coins ?? {}) };
    if ((coins[playerId] ?? 0) < RUMOR_COST) return state;
    coins[playerId] = (coins[playerId] ?? 0) - RUMOR_COST;

    const delta = direction === 'up' ? 2 : -2;
    const prices = {
      ...meta.prices,
      [good]: clampPrice((meta.prices[good] ?? 0) + delta),
    };
    const label = GOOD_LABELS[good];
    let next = this.setMeta(state, {
      ...meta,
      coins,
      prices,
      lastMarketEvent: `Rumeur sur ${label}: prix ${prices[good]}.`,
    });
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} lance une rumeur sur ${label}.`,
    );
    return this.finishAction(next);
  }

  private handleProtect(state: GameStateEntity): GameStateEntity {
    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;
    const meta = this.getMeta(state);
    const coins = { ...(meta.coins ?? {}) };
    if ((coins[playerId] ?? 0) < PROTECT_COST) return state;
    coins[playerId] = (coins[playerId] ?? 0) - PROTECT_COST;
    const protectedPlayers = {
      ...(meta.protectedPlayers ?? {}),
      [playerId]: true,
    };
    let next = this.setMeta(state, {
      ...meta,
      coins,
      protectedPlayers,
      lastMarketEvent: 'Un etal est sous bonne garde.',
    });
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} protege son etal.`,
    );
    return this.finishAction(next);
  }

  private handleStealDeal(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const playerId = state.turn?.currentPlayerId ?? null;
    const payload = (action.payload ?? {}) as MarketActionPayload;
    const good = parseGood(payload.good);
    const targetPlayerId = Number(payload.targetPlayerId ?? 0);
    if (playerId == null || !good || targetPlayerId <= 0) return state;

    const meta = this.getMeta(state);
    if (meta.protectedPlayers?.[targetPlayerId]) return state;
    const inventories = { ...(meta.inventories ?? {}) };
    const actorInventory = copyInventory(inventories[playerId]);
    const targetInventory = copyInventory(inventories[targetPlayerId]);
    if (targetInventory[good] <= 0) return state;

    targetInventory[good] -= 1;
    actorInventory[good] += 1;
    inventories[playerId] = actorInventory;
    inventories[targetPlayerId] = targetInventory;

    const label = GOOD_LABELS[good];
    let next = this.setMeta(state, {
      ...meta,
      inventories,
      lastMarketEvent: `${label} change discretement de main.`,
    });
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} vole une bonne affaire a ${resolvePlayerNameFromState(next, targetPlayerId)}: ${label}.`,
    );
    return this.finishAction(next);
  }

  private finishAction(state: GameStateEntity, suffix?: string): GameStateEntity {
    const playerId = state.turn?.currentPlayerId ?? null;
    let next = state;
    if (suffix && playerId != null) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} ${suffix}`,
      );
    }

    const meta = this.getMeta(next);
    const players = Array.isArray(next.players) ? next.players : [];
    const turnsTaken = (meta.turnsTaken ?? 0) + 1;
    const maxTurns = Math.max(1, players.length) * Math.max(1, meta.maxRounds);
    const nextRound = Math.floor(turnsTaken / Math.max(1, players.length)) + 1;
    const protectedPlayers =
      playerId == null
        ? meta.protectedPlayers
        : { ...(meta.protectedPlayers ?? {}), [playerId]: false };

    next = this.setMeta(next, {
      ...meta,
      turnsTaken,
      round: Math.min(meta.maxRounds, nextRound),
      protectedPlayers,
    });

    if (turnsTaken >= maxTurns) {
      return this.finishGame(next);
    }

    return this.turns.advanceTurn(next);
  }

  private finishGame(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const winnerId = this.determineWinner(state, meta);
    const next = {
      ...state,
      status: 'finished',
      metadata: { ...meta, winnerId },
    };
    return this.core.appendLog(
      next,
      winnerId
        ? `${resolvePlayerNameFromState(next, winnerId)} devient la grande fortune du Marche des Merveilles !`
        : 'Le Marche des Merveilles se termine sur une egalite.',
    );
  }

  private determineWinner(
    state: GameStateEntity,
    meta: LeMarcheDesMerveillesMetadata,
  ): number | null {
    let bestId: number | null = null;
    let bestScore = -Infinity;
    let tie = false;
    for (const player of state.players ?? []) {
      const playerId = Number(player?.id ?? 0);
      if (playerId <= 0) continue;
      const score =
        (meta.coins?.[playerId] ?? 0) +
        inventoryValue(meta.inventories?.[playerId], meta.prices);
      if (score > bestScore) {
        bestScore = score;
        bestId = playerId;
        tie = false;
      } else if (score === bestScore) {
        tie = true;
      }
    }
    return tie ? null : bestId;
  }

  private setMeta(
    state: GameStateEntity,
    meta: LeMarcheDesMerveillesMetadata,
  ): GameStateEntity {
    return { ...state, metadata: meta };
  }

  private getMeta(state: GameStateEntity): LeMarcheDesMerveillesMetadata {
    return (state.metadata ?? {}) as LeMarcheDesMerveillesMetadata;
  }
}
