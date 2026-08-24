import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { PanierExpressUtils } from '../application/services/panier-express-utils.service';
import type {
  PanierExpressMetadata,
  PanierExpressPlayer,
} from '../model/panier-express-state.model';

export function removeOne(collection: string[], value: string): string[] {
  const copy = [...collection];
  const idx = copy.findIndex((entry) => entry === value);
  if (idx >= 0) {
    copy.splice(idx, 1);
  }
  return copy;
}

function addCardToPlayer(
  utils: PanierExpressUtils,
  player: PanierExpressPlayer,
  card: string,
): { player: PanierExpressPlayer; kept: boolean; discarded: boolean } {
  const trimmed = String(card ?? '').trim();
  if (!trimmed || !player) {
    return { player, kept: false, discarded: false };
  }
  const list = utils.toStringArray(player.shoppingList);
  const basket = utils.toStringArray(player.basket);
  const inventory = utils.toStringArray(player.inventory);
  const alreadyInBasket = basket.includes(trimmed);
  const alreadyInInventory = inventory.includes(trimmed);
  const isNeeded = list.includes(trimmed) && !alreadyInBasket;

  if (alreadyInBasket || alreadyInInventory) {
    if (isNeeded && alreadyInInventory) {
      return {
        player: {
          ...player,
          basket: [...basket, trimmed],
          inventory: utils.removeOne(inventory, trimmed),
        },
        kept: false,
        discarded: true,
      };
    }
    return {
      player: { ...player, basket, inventory },
      kept: false,
      discarded: true,
    };
  }

  if (isNeeded) {
    return {
      player: { ...player, basket: [...basket, trimmed], inventory },
      kept: true,
      discarded: false,
    };
  }

  if (inventory.length >= 5) {
    return {
      player: { ...player, basket, inventory },
      kept: false,
      discarded: true,
    };
  }

  return {
    player: { ...player, inventory: [trimmed, ...inventory], basket },
    kept: true,
    discarded: false,
  };
}

export function addCardToPlayerState(
  utils: PanierExpressUtils,
  state: GameStateEntity,
  playerId: number,
  card: string,
): GameStateEntity {
  const trimmed = String(card ?? '').trim();
  if (!trimmed) return state;
  let kept = false;
  let discarded = false;
  const players = ((state.players ?? []) as PanierExpressPlayer[]).map((player) => {
    if (player.id !== playerId) return player;
    const result = addCardToPlayer(utils, player, trimmed);
    kept = result.kept;
    discarded = result.discarded;
    return result.player;
  });
  const meta = (state.metadata ?? {}) as Partial<PanierExpressMetadata>;
  const currentDiscards = Array.isArray(meta?.discards?.courses)
    ? meta.discards.courses.map((value) => String(value))
    : [];
  return {
    ...state,
    players,
    metadata: {
      ...meta,
      lastObtainedCourse: {
        ...(meta?.lastObtainedCourse ?? {}),
        [playerId]: kept ? trimmed : null,
      },
      discards: {
        ...(meta?.discards ?? {}),
        courses: discarded ? [...currentDiscards, trimmed] : currentDiscards,
      },
    },
  };
}

export function removeFromInventoryState(
  utils: PanierExpressUtils,
  state: GameStateEntity,
  playerId: number,
  card: string,
): GameStateEntity {
  const trimmed = String(card ?? '').trim();
  if (!trimmed) return state;
  const players = ((state.players ?? []) as PanierExpressPlayer[]).map((player) => {
    if (player.id !== playerId) return player;
    const inventory = utils.toStringArray(player.inventory);
    return { ...player, inventory: removeOne(inventory, trimmed) };
  });
  return { ...state, players };
}

export function setInventoryState(
  utils: PanierExpressUtils,
  state: GameStateEntity,
  playerId: number,
  inventory: string[],
): GameStateEntity {
  const nextInventory = utils.toStringArray(inventory);
  const players = ((state.players ?? []) as PanierExpressPlayer[]).map((player) => {
    if (player.id !== playerId) return player;
    return { ...player, inventory: nextInventory };
  });
  return { ...state, players };
}

export function addToDiscardState(
  state: GameStateEntity,
  card: string,
): GameStateEntity {
  const trimmed = String(card ?? '').trim();
  if (!trimmed) return state;
  const meta = (state.metadata ?? {}) as Partial<PanierExpressMetadata>;
  const current = Array.isArray(meta?.discards?.courses)
    ? meta.discards.courses.map((value) => String(value))
    : [];
  return {
    ...state,
    metadata: {
      ...meta,
      discards: {
        ...(meta?.discards ?? {}),
        courses: [...current, trimmed],
      },
    },
  };
}

export function setSkipTurns(
  state: GameStateEntity,
  playerId: number,
  turns: number,
): GameStateEntity {
  const meta = (state.metadata ?? {}) as Partial<PanierExpressMetadata>;
  const current = meta?.statuses?.skipTurn?.[playerId] ?? 0;
  const nextCount = Math.max(current, Math.max(1, turns || 1));
  return {
    ...state,
    metadata: {
      ...meta,
      statuses: {
        ...(meta?.statuses ?? {}),
        skipTurn: {
          ...(meta?.statuses?.skipTurn ?? {}),
          [playerId]: nextCount,
        },
      },
    },
  };
}




