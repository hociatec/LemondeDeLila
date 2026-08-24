import { GameStateEntity } from '../../../application/models/game-state.model';
import {
  PanierExpressMetadata,
  PanierExpressPlayer,
} from './model/panier-express-state.model';
import { asRecord, toText } from './panier-express-state.helpers';

export function mergePanierExpressMetadataWithDefaults(
  state: GameStateEntity,
  defaults: PanierExpressMetadata,
): PanierExpressMetadata {
  const existing = (state.metadata as PanierExpressMetadata) ?? null;
  if (!existing) {
    return defaults;
  }

  return {
    ...defaults,
    ...existing,
    decks: mergePanierExpressDecks(defaults.decks, existing.decks),
    positions: { ...defaults.positions, ...(existing.positions ?? {}) },
    laps: { ...defaults.laps, ...(existing.laps ?? {}) },
    quiz: existing.quiz ?? defaults.quiz,
    quizOutcome: existing.quizOutcome ?? defaults.quizOutcome,
    actionLog: existing.actionLog ?? defaults.actionLog,
    botProfile: existing.botProfile ?? defaults.botProfile,
    statuses: mergePanierExpressStatuses(defaults.statuses, existing.statuses),
  };
}

export function hydratePanierExpressMetadataCollections(args: {
  state: GameStateEntity;
  metadata: PanierExpressMetadata;
  players: PanierExpressPlayer[];
  buildDeckPool: (state: GameStateEntity) => PanierExpressMetadata['decks'];
}): PanierExpressMetadata {
  const decks = args.metadata.decks ?? args.buildDeckPool(args.state);
  const quiz = args.metadata.quiz;
  const quizOutcome = ensurePanierExpressQuizOutcome(
    args.metadata.quizOutcome,
    args.players,
  );
  const statuses = mergePanierExpressStatuses(
    {
      skipTurn: {},
      keepTurn: {},
      revealInventory: {},
      revealShoppingList: {},
      noDrawCourses: {},
    },
    args.metadata.statuses,
  );
  const positions = ensurePanierExpressPlayerPositions(
    args.metadata.positions,
    args.players,
  );
  const actionLog = Array.isArray(args.metadata.actionLog)
    ? args.metadata.actionLog
    : [];
  const laps = ensurePanierExpressPlayerLaps(args.metadata.laps, args.players);
  const discards: PanierExpressMetadata['discards'] = {
    courses: Array.isArray(args.metadata.discards?.courses)
      ? args.metadata.discards?.courses.map((value) => String(value))
      : [],
  };
  const lastObtainedCourse: Record<number, string | null> = {};
  Object.entries(asRecord(args.metadata.lastObtainedCourse)).forEach(
    ([playerId, value]) => {
      const id = Number(playerId);
      if (!Number.isFinite(id)) {
        return;
      }

      const trimmed = toText(value).trim();
      lastObtainedCourse[id] = trimmed ? trimmed : null;
    },
  );

  return {
    ...args.metadata,
    decks,
    quiz,
    quizOutcome,
    statuses,
    positions,
    laps,
    actionLog,
    discards,
    movementDirection:
      args.metadata.movementDirection === -1 ||
      args.metadata.movementDirection === 1
        ? args.metadata.movementDirection
        : 1,
    movementDirectionOwnerId:
      typeof args.metadata.movementDirectionOwnerId === 'number'
        ? args.metadata.movementDirectionOwnerId
        : null,
    lastObtainedCourse,
  };
}

export function ensurePanierExpressPlayerLaps(
  laps: Record<number, number> | undefined,
  players: PanierExpressPlayer[],
): Record<number, number> {
  const ensured: Record<number, number> = { ...(laps ?? {}) };
  players.forEach((player) => {
    if (typeof ensured[player.id] !== 'number') {
      ensured[player.id] = 0;
    }
    if (ensured[player.id] < -1) {
      ensured[player.id] = -1;
    }
  });
  return ensured;
}

export function mergePanierExpressDecks(
  defaults: PanierExpressMetadata['decks'],
  override?: PanierExpressMetadata['decks'],
): PanierExpressMetadata['decks'] {
  if (!override) {
    return defaults;
  }

  const merged = { ...defaults };
  Object.keys(override).forEach((key) => {
    merged[key] = override[key];
  });
  return merged;
}

export function mergePanierExpressStatuses(
  defaults: PanierExpressMetadata['statuses'],
  override?: PanierExpressMetadata['statuses'],
): PanierExpressMetadata['statuses'] {
  return {
    skipTurn: { ...(defaults.skipTurn ?? {}), ...(override?.skipTurn ?? {}) },
    keepTurn: { ...(defaults.keepTurn ?? {}), ...(override?.keepTurn ?? {}) },
    revealInventory: {
      ...(defaults.revealInventory ?? {}),
      ...(override?.revealInventory ?? {}),
    },
    revealShoppingList: {
      ...(defaults.revealShoppingList ?? {}),
      ...(override?.revealShoppingList ?? {}),
    },
    noDrawCourses: {
      ...(defaults.noDrawCourses ?? {}),
      ...(override?.noDrawCourses ?? {}),
    },
  };
}

export function ensurePanierExpressPlayerPositions(
  positions: Record<number, number> | undefined,
  players: PanierExpressPlayer[],
): Record<number, number> {
  const resolved = { ...(positions ?? {}) };
  players.forEach((player) => {
    if (typeof resolved[player.id] !== 'number') {
      resolved[player.id] = 0;
    }
  });
  return resolved;
}

export function ensurePanierExpressQuizOutcome(
  entries: PanierExpressMetadata['quizOutcome'] | undefined,
  players: PanierExpressPlayer[],
): PanierExpressMetadata['quizOutcome'] {
  const normalized: PanierExpressMetadata['quizOutcome'] = {};
  if (!entries) {
    return normalized;
  }

  players.forEach((player) => {
    const entry = entries[player.id];
    if (entry) {
      normalized[player.id] = entry;
    }
  });
  return normalized;
}




