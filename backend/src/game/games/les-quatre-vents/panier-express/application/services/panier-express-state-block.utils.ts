import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { RandomService } from '../../../../../core/application/services/random.service';

import type {
  PanierExpressDeckPool,
  PanierExpressMetadata,
  PanierExpressTile,
} from '../../model/panier-express-state.model';

export function applyPanierExpressWeatherBackBlock(args: {
  state: GameStateEntity;
  playerId: number;
  random: RandomService;
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  movePlayer: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  resolveTile: (state: GameStateEntity, playerId: number) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const {
    state,
    playerId,
    random,
    ensureMetadata,
    getMetadata,
    movePlayer,
    resolveTile,
    appendLog,
  } = args;
  if (state.pending) {
    return appendLog(
      state,
      '[Panier Express] Un autre choix est déjà en attente.',
    );
  }

  const ensured = ensureMetadata(state);
  const meta = getMetadata(ensured);
  const rng = random.nextInt(meta, 10);
  const steps = rng.value + 1;
  const baseState = { ...ensured, metadata: rng.meta };
  const moved = movePlayer(baseState, playerId, -steps);
  return resolveTile(moved, playerId);
}

export function applyPanierExpressMoveToNextStandBlock(args: {
  state: GameStateEntity;
  playerId: number;
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  buildTiles: () => PanierExpressTile[];
  moveCircular: (size: number, position: number, delta: number) => number;
  movePlayer: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  resolveTile: (state: GameStateEntity, playerId: number) => GameStateEntity;
}): GameStateEntity {
  const {
    state,
    playerId,
    ensureMetadata,
    getMetadata,
    buildTiles,
    moveCircular,
    movePlayer,
    resolveTile,
  } = args;
  const ensured = ensureMetadata(state);
  const meta = getMetadata(ensured);
  const tiles =
    Array.isArray(meta.tiles) && meta.tiles.length ? meta.tiles : buildTiles();
  const currentPos = meta.positions[playerId] ?? 0;
  const total = tiles.length;
  let steps = 1;
  for (; steps < total; steps += 1) {
    const idx = moveCircular(total, currentPos, steps);
    const tile = tiles[idx];
    if (tile?.type === 'stand') {
      break;
    }
  }
  const moved = movePlayer(ensured, playerId, steps);
  return resolveTile(moved, playerId);
}

export function applyPanierExpressSkipTurnTileBlock(args: {
  state: GameStateEntity;
  playerId: number;
  turns: number;
  silent?: boolean;
  setStatus: (
    state: GameStateEntity,
    playerId: number,
    status: string,
    count: number,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
}): GameStateEntity {
  const {
    state,
    playerId,
    turns,
    silent = false,
    setStatus,
    appendLog,
    playerName,
  } = args;
  const count = Math.max(1, turns || 1);
  const next = setStatus(state, playerId, 'skipTurn', count);
  if (silent) return next;
  return appendLog(
    next,
    `[Panier Express] ${playerName(state, playerId)} perd ${count} tour(s).`,
  );
}

export function removePanierExpressIngredientFromInventoryBlock(args: {
  state: GameStateEntity;
  playerId: number;
  ingredient: string;
  toStringArray: (value: unknown) => string[];
  removeOne: (items: string[], value: string) => string[];
}): GameStateEntity {
  const { state, playerId, ingredient, toStringArray, removeOne } = args;
  const trimmed = String(ingredient ?? '').trim();
  if (!trimmed) return state;
  const players = (state.players ?? []).map((player) => {
    if (player.id !== playerId) return player;
    const inventory = toStringArray(player.inventory);
    if (!inventory.includes(trimmed)) return player;
    return { ...player, inventory: removeOne(inventory, trimmed) };
  });
  return { ...state, players };
}

export function addPanierExpressCourseToDiscardsBlock(args: {
  state: GameStateEntity;
  course: string;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
}): GameStateEntity {
  const { state, course, getMetadata } = args;
  const trimmed = String(course ?? '').trim();
  if (!trimmed) return state;
  const meta = getMetadata(state);
  const current = Array.isArray(meta.discards?.courses)
    ? meta.discards.courses.map((value) => String(value))
    : [];
  return {
    ...state,
    metadata: {
      ...meta,
      discards: {
        ...meta.discards,
        courses: [...current, trimmed],
      },
    },
  };
}

export function drawPanierExpressCardFromPoolBlock<T = unknown>(args: {
  meta: PanierExpressMetadata;
  key: string;
  draw: (
    pool: PanierExpressDeckPool,
    key: string,
  ) => { card: unknown; pool: PanierExpressDeckPool };
}): {
  card: T | undefined;
  metadata: PanierExpressMetadata;
} {
  const { meta, key, draw } = args;
  const { card, pool } = draw(meta.decks, key);
  return {
    card: card == null ? undefined : (card as T),
    metadata: { ...meta, decks: pool },
  };
}
