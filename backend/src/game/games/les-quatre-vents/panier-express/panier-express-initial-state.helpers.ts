import { GameStateEntity } from '../../../core/entities/game-state.entity';
import {
  PanierExpressMetadata,
  PanierExpressPlayer,
} from './model/panier-express-state.entity';
import { ensureShoppingLists, toStringArray } from './panier-express.shopping';

type HydratePanierExpressInitialStateArgs = {
  baseState: GameStateEntity;
  buildMetadata: (baseState: GameStateEntity) => PanierExpressMetadata;
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  queuePawnSelection: (state: GameStateEntity) => GameStateEntity;
  pawns: string[];
  courseItems: string[];
  getPawnText: (player: unknown) => string;
  category: string;
  subcategory: string;
  shoppingListSize: number;
};

export function hydratePanierExpressInitialState({
  baseState,
  buildMetadata,
  ensureMetadata,
  queuePawnSelection,
  pawns,
  courseItems,
  getPawnText,
  category,
  subcategory,
  shoppingListSize,
}: HydratePanierExpressInitialStateArgs): GameStateEntity {
  const status = (baseState.status || '').toLowerCase();
  const players = baseState.players ?? [];
  const meta = asRecord(baseState.metadata);
  const looksInitialized =
    Boolean(meta.category) ||
    Boolean(meta.subcategory) ||
    Boolean(meta.tiles) ||
    Boolean(meta.positions) ||
    Boolean(meta.decks);
  const inProgress =
    status === 'finished' ||
    status === 'running' ||
    (typeof baseState.turnIndex === 'number' && baseState.turnIndex > 0) ||
    looksInitialized ||
    Boolean(baseState.pending) ||
    players.some((player) => hasPlayerProgress(player));
  if (inProgress) {
    return ensureMetadata({
      ...baseState,
      status: baseState.status ?? 'started',
    });
  }

  const existingMeta = (baseState.metadata as PanierExpressMetadata) ?? null;
  const baseMeta = buildMetadata(baseState);
  const metadata: PanierExpressMetadata = {
    ...baseMeta,
    ...(existingMeta ?? {}),
    decks: existingMeta?.decks
      ? { ...baseMeta.decks, ...existingMeta.decks }
      : baseMeta.decks,
  };

  const hydratedPlayers = hydratePlayers(players, pawns, getPawnText);
  const baseMetadata = (baseState.metadata ?? {}) as Record<string, unknown>;
  const seedEnvelope = ensureSeedEnvelope({
    metadata,
    baseMetadata,
    players: hydratedPlayers,
  });

  const repaired = ensureShoppingLists({
    metadata: seedEnvelope as PanierExpressMetadata,
    players: hydratedPlayers,
    courseItems,
    shoppingListSize,
    toStringArray,
  });

  const positions: Record<number, number> = {};
  repaired.players.forEach((player) => {
    positions[player.id] = 0;
  });

  return queuePawnSelection({
    ...baseState,
    players: repaired.players,
    status: baseState.status ?? 'open',
    metadata: {
      ...baseMetadata,
      category,
      subcategory,
      ...repaired.metadata,
      positions,
    },
  });
}

function hasPlayerProgress(player: Record<string, unknown>): boolean {
  const hasList =
    Array.isArray(player.shoppingList) && player.shoppingList.length > 0;
  const hasBasket = Array.isArray(player.basket) && player.basket.length > 0;
  const hasInventory =
    Array.isArray(player.inventory) && player.inventory.length > 0;
  return hasList || hasBasket || hasInventory;
}

function hydratePlayers(
  players: Record<string, unknown>[],
  pawns: string[],
  getPawnText: (player: unknown) => string,
): PanierExpressPlayer[] {
  const assignmentOrder = [...players].sort(comparePlayersForInitialAssignment);
  let pawnIndex = 0;
  const usedPawns = new Set<string>();
  const assignedById = new Map<
    number,
    { list: string[]; pawn?: string; isBot: boolean }
  >();

  assignmentOrder.forEach((player) => {
    const username = String(player.username ?? '').toLowerCase();
    const isBot = player.isBot === true || username.includes('bot');
    const existingList = toStringArray(player.shoppingList).slice(0, 3);
    const existingPawn = getPawnText(player);
    let pawn = existingPawn.length > 0 ? existingPawn : undefined;
    if (pawn) {
      usedPawns.add(pawn);
    }
    if (!pawn && isBot && pawns.length) {
      const available = pawns.find((entry) => !usedPawns.has(entry));
      pawn = available ?? pawns[pawnIndex++ % pawns.length];
      if (pawn) {
        usedPawns.add(pawn);
      }
    }
    assignedById.set(Number(player.id), {
      list: existingList.length > 0 ? existingList : [],
      pawn,
      isBot,
    });
  });

  return players.map((player) => {
    const assigned = assignedById.get(Number(player.id));
    return {
      ...(player as PanierExpressPlayer),
      isBot: assigned?.isBot ?? player.isBot === true,
      basket: Array.isArray(player.basket)
        ? player.basket.map((item) => String(item))
        : [],
      inventory: Array.isArray(player.inventory)
        ? player.inventory.map((item) => String(item))
        : [],
      shoppingList:
        assigned?.list ?? toStringArray(player.shoppingList).slice(0, 3),
      pawn: assigned?.pawn,
    };
  });
}

function comparePlayersForInitialAssignment(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): number {
  const leftBot = left.isBot === true;
  const rightBot = right.isBot === true;
  if (leftBot !== rightBot) {
    return leftBot ? 1 : -1;
  }
  return Number(left.id ?? 0) - Number(right.id ?? 0);
}

function ensureSeedEnvelope(args: {
  metadata: PanierExpressMetadata;
  baseMetadata: Record<string, unknown>;
  players: PanierExpressPlayer[];
}): Record<string, unknown> {
  const seedEnvelope = {
    ...args.metadata,
    ...args.baseMetadata,
  } as Record<string, unknown>;
  const rng = seedEnvelope['rng'];
  const hasExplicitSeed =
    rng != null &&
    typeof rng === 'object' &&
    !Array.isArray(rng) &&
    Number.isFinite(Number((rng as { seed?: unknown }).seed));
  const hasRoomContext =
    seedEnvelope['roomId'] != null && seedEnvelope['roomStartedAt'] != null;

  if (!hasExplicitSeed && !hasRoomContext) {
    let derivedSeed = 1;
    for (const player of args.players) {
      const id =
        typeof player.id === 'number' ? player.id : Number(player.id ?? NaN);
      if (!Number.isFinite(id)) {
        continue;
      }
      derivedSeed = (derivedSeed * 31 + (id >>> 0)) >>> 0;
    }
    seedEnvelope['rng'] = { seed: derivedSeed >>> 0, counter: 0 };
  }

  return seedEnvelope;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') {
    return {};
  }
  return value as Record<string, unknown>;
}
