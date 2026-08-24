import { GameStateEntity } from '../../../application/models/game-state.model';
import { PendingState } from '../../../application/models/game-state.model';
import { PanierExpressMetadata } from './model/panier-express-state.model';

export function setPanierExpressPickPending(args: {
  state: GameStateEntity;
  playerId: number;
  label: string;
  kind: string;
  choices: string[];
  data?: Record<string, unknown>;
}): GameStateEntity {
  const pendingState: PendingState = {
    type: 'pick',
    playerId: args.playerId,
    blocking: true,
    label: args.label,
    choices: args.choices,
    data: { kind: args.kind, ...(args.data ?? {}) },
  };
  return {
    ...args.state,
    pending: pendingState,
  };
}

export function getPanierExpressDiscardCourses(
  state: GameStateEntity,
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata,
): string[] {
  const metadata = getMetadata(state);
  return Array.isArray(metadata.discards?.courses)
    ? metadata.discards?.courses.map((value) => String(value))
    : [];
}

export function addPanierExpressCourseToDiscard(args: {
  state: GameStateEntity;
  card: string;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
}): GameStateEntity {
  const trimmed = String(args.card ?? '').trim();
  if (!trimmed) {
    return args.state;
  }

  const current = getPanierExpressDiscardCourses(args.state, args.getMetadata);
  const metadata = args.getMetadata(args.state);
  return {
    ...args.state,
    metadata: {
      ...metadata,
      discards: { ...metadata.discards, courses: [...current, trimmed] },
    },
  };
}

export function removePanierExpressCourseFromPlayer(args: {
  state: GameStateEntity;
  playerId: number;
  card: string;
  toStringArray: (value: unknown) => string[];
  removeOne: (items: string[], value: string) => string[];
}): { state: GameStateEntity; updated: boolean } {
  const trimmed = String(args.card ?? '').trim();
  if (!trimmed) {
    return { state: args.state, updated: false };
  }

  let updated = false;
  const players = (args.state.players ?? []).map((player) => {
    if (player.id !== args.playerId) {
      return player;
    }

    const basket = args.toStringArray(player.basket);
    const inventory = args.toStringArray(player.inventory);
    if (basket.includes(trimmed)) {
      updated = true;
      return { ...player, basket: args.removeOne(basket, trimmed) };
    }
    if (inventory.includes(trimmed)) {
      updated = true;
      return { ...player, inventory: args.removeOne(inventory, trimmed) };
    }
    return player;
  });

  return {
    state: { ...args.state, players },
    updated,
  };
}

export function removePanierExpressCourseFromInventory(args: {
  state: GameStateEntity;
  playerId: number;
  card: string;
  toStringArray: (value: unknown) => string[];
  removeOne: (items: string[], value: string) => string[];
}): { state: GameStateEntity; updated: boolean } {
  const trimmed = String(args.card ?? '').trim();
  if (!trimmed) {
    return { state: args.state, updated: false };
  }

  let updated = false;
  const players = (args.state.players ?? []).map((player) => {
    if (player.id !== args.playerId) {
      return player;
    }
    const inventory = args.toStringArray(player.inventory);
    if (!inventory.includes(trimmed)) {
      return player;
    }
    updated = true;
    return { ...player, inventory: args.removeOne(inventory, trimmed) };
  });

  return {
    state: { ...args.state, players },
    updated,
  };
}

export function addPanierExpressCourseToPlayer(args: {
  state: GameStateEntity;
  playerId: number;
  card: string;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  toStringArray: (value: unknown) => string[];
  removeOne: (items: string[], value: string) => string[];
}): GameStateEntity {
  const trimmed = String(args.card ?? '').trim();
  if (!trimmed) {
    return args.state;
  }

  let next = args.state;
  const players = (next.players ?? []).map((player) => {
    if (player.id !== args.playerId) {
      return player;
    }
    const list = args.toStringArray(player.shoppingList);
    const basket = args.toStringArray(player.basket);
    const inventory = args.toStringArray(player.inventory);
    const alreadyInBasket = basket.includes(trimmed);
    const alreadyInInventory = inventory.includes(trimmed);
    const isNeeded = list.includes(trimmed) && !alreadyInBasket;

    if (alreadyInBasket || alreadyInInventory) {
      if (isNeeded && alreadyInInventory) {
        return {
          ...player,
          basket: [...basket, trimmed],
          inventory: args.removeOne(inventory, trimmed),
        };
      }
      next = addPanierExpressCourseToDiscard({
        state: next,
        card: trimmed,
        getMetadata: args.getMetadata,
      });
      return player;
    }

    if (isNeeded) {
      return { ...player, basket: [...basket, trimmed], inventory };
    }

    if (inventory.length >= 5) {
      next = addPanierExpressCourseToDiscard({
        state: next,
        card: trimmed,
        getMetadata: args.getMetadata,
      });
      return player;
    }

    return { ...player, inventory: [...inventory, trimmed], basket };
  });

  next = { ...next, players };
  const metadata = args.getMetadata(next);
  const playerNow = (next.players ?? []).find(
    (player) => player.id === args.playerId,
  );
  const hasCard =
    args.toStringArray(playerNow?.basket).includes(trimmed) ||
    args.toStringArray(playerNow?.inventory).includes(trimmed);
  if (!hasCard) {
    return next;
  }

  return {
    ...next,
    metadata: {
      ...metadata,
      lastObtainedCourse: {
        ...(metadata.lastObtainedCourse ?? {}),
        [args.playerId]: trimmed,
      },
    },
  };
}

export function discardPanierExpressRandomCourse(args: {
  state: GameStateEntity;
  playerId: number;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  createMetaRng: (metadata: PanierExpressMetadata) => {
    getMeta: () => PanierExpressMetadata;
  };
  pickOne: <T>(
    metadata: PanierExpressMetadata,
    items: T[],
  ) => { meta: PanierExpressMetadata; value: T | null };
  toStringArray: (value: unknown) => string[];
  removeOne: (items: string[], value: string) => string[];
}): { state: GameStateEntity; discarded: string | null } {
  const player = (args.state.players ?? []).find(
    (entry) => entry.id === args.playerId,
  );
  if (!player) {
    return { state: args.state, discarded: null };
  }

  const basket = args.toStringArray(player.basket);
  const inventory = args.toStringArray(player.inventory);
  if (!inventory.length) {
    return { state: args.state, discarded: null };
  }

  const inventoryOnly = basket.length
    ? inventory.filter((card) => !basket.includes(card))
    : inventory;
  if (!inventoryOnly.length) {
    return { state: args.state, discarded: null };
  }

  const metaRng = args.createMetaRng(args.getMetadata(args.state));
  const picked = args.pickOne(metaRng.getMeta(), inventoryOnly);
  let next: GameStateEntity = { ...args.state, metadata: picked.meta };
  const card = String(picked.value ?? '').trim();
  if (!card) {
    return { state: next, discarded: null };
  }

  const removed = removePanierExpressCourseFromInventory({
    state: next,
    playerId: args.playerId,
    card,
    toStringArray: args.toStringArray,
    removeOne: args.removeOne,
  });
  next = removed.state;
  if (!removed.updated) {
    return { state: next, discarded: null };
  }

  next = addPanierExpressCourseToDiscard({
    state: next,
    card,
    getMetadata: args.getMetadata,
  });
  return { state: next, discarded: card };
}




