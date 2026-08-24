import type { GameStateEntity } from '../../../application/models/game-state.model';
import type {
  PanierExpressMetadata,
  PanierExpressTile,
} from './model/panier-express-state.model';

export function applyPanierExpressWeatherBack(input: {
  state: GameStateEntity;
  playerId: number;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  nextInt: (
    metadata: PanierExpressMetadata,
    maxExclusive: number,
  ) => { value: number; meta: PanierExpressMetadata };
  movePlayer: (
    state: GameStateEntity,
    playerId: number,
    roll: number,
  ) => GameStateEntity;
  resolveTile: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
}): GameStateEntity {
  if (input.state.pending) {
    return input.appendLog(
      input.state,
      `[Panier Express] Un autre choix est déjà en attente.`,
    );
  }

  const ensured = input.ensureMetadata(input.state);
  const meta = input.getMetadata(ensured);
  const rng = input.nextInt(meta, 10);
  const steps = rng.value + 1;
  const baseState = { ...ensured, metadata: rng.meta };
  const moved = input.movePlayer(baseState, input.playerId, -steps);
  return input.resolveTile(moved, input.playerId);
}

export function applyPanierExpressMoveToNextStand(input: {
  state: GameStateEntity;
  playerId: number;
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  buildTiles: () => PanierExpressTile[];
  moveCircular: (
    length: number,
    currentPosition: number,
    delta: number,
  ) => number;
  movePlayer: (
    state: GameStateEntity,
    playerId: number,
    roll: number,
  ) => GameStateEntity;
  resolveTile: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const ensured = input.ensureMetadata(input.state);
  const meta = input.getMetadata(ensured);
  const tiles =
    Array.isArray(meta.tiles) && meta.tiles.length ? meta.tiles : input.buildTiles();
  const currentPos = meta.positions[input.playerId] ?? 0;
  const total = tiles.length;
  let steps = 1;
  for (; steps < total; steps += 1) {
    const idx = input.moveCircular(total, currentPos, steps);
    const tile = tiles[idx];
    if (tile?.type === 'stand') {
      break;
    }
  }
  const moved = input.movePlayer(ensured, input.playerId, steps);
  return input.resolveTile(moved, input.playerId);
}

export function applyPanierExpressSkipTurnTile(input: {
  state: GameStateEntity;
  playerId: number;
  turns: number;
  silent?: boolean;
  setTurnStatus: (
    state: GameStateEntity,
    playerId: number,
    key: string,
    value: number,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
}): GameStateEntity {
  const count = Math.max(1, input.turns || 1);
  const next = input.setTurnStatus(input.state, input.playerId, 'skipTurn', count);
  if (input.silent) return next;
  return input.appendLog(
    next,
    `[Panier Express] ${input.playerName(input.state, input.playerId)} perd ${count} tour(s).`,
  );
}

export function removePanierExpressIngredientFromInventory(input: {
  state: GameStateEntity;
  playerId: number;
  ingredient: string;
  toStringArray: (value: unknown) => string[];
  removeOne: (items: string[], value: string) => string[];
}): GameStateEntity {
  const trimmed = String(input.ingredient ?? '').trim();
  if (!trimmed) return input.state;
  const players = (input.state.players ?? []).map((player) => {
    if (player.id !== input.playerId) return player;
    const inventory = input.toStringArray(player.inventory);
    if (!inventory.includes(trimmed)) return player;
    return { ...player, inventory: input.removeOne(inventory, trimmed) };
  });
  return { ...input.state, players };
}

export function addPanierExpressCourseToDiscards(input: {
  state: GameStateEntity;
  course: string;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
}): GameStateEntity {
  const trimmed = String(input.course ?? '').trim();
  if (!trimmed) return input.state;
  const meta = input.getMetadata(input.state);
  const current = Array.isArray(meta.discards?.courses)
    ? meta.discards.courses.map((value) => String(value))
    : [];
  return {
    ...input.state,
    metadata: {
      ...meta,
      discards: {
        ...meta.discards,
        courses: [...current, trimmed],
      },
    },
  };
}




