import { GameStateEntity } from '../../../core/entities/game-state.entity';
import { PanierExpressDeckPool, PanierExpressMetadata } from './model/panier-express-state.entity';
import { toText } from './panier-express-state.helpers';

export function handlePanierExpressLuckyDraw(args: {
  state: GameStateEntity;
  playerId: number;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  createMetaRng: (
    metadata: PanierExpressMetadata,
  ) => { rng: unknown; getMeta: () => PanierExpressMetadata };
  drawPool: (
    pool: PanierExpressDeckPool,
    deckKey: string,
    rng: unknown,
  ) => { pool: PanierExpressDeckPool; card: string | undefined };
  discardPool: (
    pool: PanierExpressDeckPool,
    deckKey: string,
    card: string,
  ) => PanierExpressDeckPool;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  advanceAfterDraw: (state: GameStateEntity) => GameStateEntity;
  withPending: (
    state: GameStateEntity,
    pending: NonNullable<GameStateEntity['pending']>,
  ) => GameStateEntity;
}): GameStateEntity {
  const metadata = args.getMetadata(args.state);
  const metaRng = args.createMetaRng(metadata);
  let nextPool: PanierExpressDeckPool = metadata.decks;
  const offered: string[] = [];
  const seen = new Set<string>();
  let safety = 0;

  while (offered.length < 3 && safety < 30) {
    const draw = args.drawPool(nextPool, 'courses-bonus', metaRng.rng);
    nextPool = draw.pool;
    const card = String(draw.card ?? '').trim();
    if (!card) {
      break;
    }

    if (seen.has(card)) {
      nextPool = args.discardPool(nextPool, 'courses-bonus', card);
    } else {
      seen.add(card);
      offered.push(card);
    }
    safety += 1;
  }

  let next: GameStateEntity = {
    ...args.state,
    metadata: {
      ...metaRng.getMeta(),
      decks: nextPool,
    },
  };

  const uniqueOffered = Array.from(new Set(offered));
  if (uniqueOffered.length !== offered.length) {
    offered.length = 0;
    offered.push(...uniqueOffered);
  }

  if (!offered.length) {
    next = args.appendLog(
      next,
      `[Panier Express] Tirage chanceux : aucune carte disponible.`,
    );
    return args.advanceAfterDraw(next);
  }

  return args.withPending(next, {
    type: 'pick',
    playerId: args.playerId,
    blocking: true,
    label: 'Choisissez une carte (tirage chanceux), puis Entrée.',
    choices: offered,
    data: { kind: 'event.tirage_chanceux', offered },
  });
}

export function handlePanierExpressGenerousProducerDraw(args: {
  state: GameStateEntity;
  playerId: number;
  drawCourse: (
    state: GameStateEntity,
    playerId: number,
    standId?: string,
  ) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  createMetaRng: (
    metadata: PanierExpressMetadata,
  ) => { rng: unknown; getMeta: () => PanierExpressMetadata };
  drawPool: (
    pool: PanierExpressDeckPool,
    deckKey: string,
    rng: unknown,
  ) => { pool: PanierExpressDeckPool; card: string | undefined };
  discardPool: (
    pool: PanierExpressDeckPool,
    deckKey: string,
    card: string,
  ) => PanierExpressDeckPool;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  advanceAfterDraw: (state: GameStateEntity) => GameStateEntity;
  withPending: (
    state: GameStateEntity,
    pending: NonNullable<GameStateEntity['pending']>,
  ) => GameStateEntity;
}): GameStateEntity {
  let next = args.drawCourse(args.state, args.playerId, 'bonus');
  const metadata = args.getMetadata(next);
  const metaRng = args.createMetaRng(metadata);
  const draw = args.drawPool(metadata.decks, 'courses-bonus', metaRng.rng);
  const offer = String(draw.card ?? '').trim();
  next = {
    ...next,
    metadata: {
      ...metaRng.getMeta(),
      decks: draw.pool,
    },
  };

  const targets = (next.players ?? [])
    .filter((player) => player.id !== args.playerId)
    .map((player) => ({ playerId: player.id, username: player.username }));

  if (!offer) {
    next = args.appendLog(
      next,
      `[Panier Express] Producteur généreux : aucune carte à offrir.`,
    );
    return args.advanceAfterDraw(next);
  }

  if (!targets.length) {
    const metaNowAfter = args.getMetadata(next);
    next = {
      ...next,
      metadata: {
        ...metaNowAfter,
        decks: args.discardPool(metaNowAfter.decks, 'courses-bonus', offer),
      },
    };
    next = args.appendLog(
      next,
      `[Panier Express] Producteur généreux : aucun joueur disponible pour recevoir une carte.`,
    );
    return args.advanceAfterDraw(next);
  }

  return args.withPending(next, {
    type: 'pick',
    playerId: args.playerId,
    blocking: true,
    label: 'Choisissez un joueur pour recevoir la carte, puis Entrée.',
    choices: targets
      .map((target) => toText(target.username).trim())
      .filter((value) => value.length > 0),
    data: {
      kind: 'event.producteur_genereux.choose_target',
      offer,
      targets,
    },
  });
}

export function handlePanierExpressSeasonChangeDraw(args: {
  state: GameStateEntity;
  playerId: number;
  data: Record<string, unknown>;
  drawCourse: (
    state: GameStateEntity,
    playerId: number,
    standId?: string,
  ) => GameStateEntity;
  toUnknownArray: (value: unknown) => unknown[];
  toStringArray: (value: unknown) => string[];
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  advanceAfterDraw: (state: GameStateEntity) => GameStateEntity;
  withPending: (
    state: GameStateEntity,
    pending: NonNullable<GameStateEntity['pending']>,
  ) => GameStateEntity;
}): GameStateEntity {
  let next = args.drawCourse(args.state, args.playerId, 'bonus');
  const order = args.toUnknownArray(args.data.order)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const cursor = Number(args.data.cursor);
  const processed = Number(args.data.processed);

  if (!order.length || !Number.isFinite(cursor) || !Number.isFinite(processed)) {
    return args.advanceAfterDraw(next);
  }

  const nextCursor = (cursor + 1) % order.length;
  const nextProcessed = processed + 1;
  while (nextProcessed < order.length) {
    const nextPlayerId = Number(order[nextCursor]);
    const player = (next.players ?? []).find((entry) => entry.id === nextPlayerId);
    const cards = args.toStringArray(player?.inventory);
    if (cards.length) {
      return args.withPending(next, {
        type: 'pick',
        playerId: nextPlayerId,
        blocking: true,
        label: 'Choisissez une carte à défausser, puis Entrée.',
        choices: cards,
        data: {
          kind: 'event.changement_de_saison',
          order,
          cursor: nextCursor,
          processed: nextProcessed,
        },
      });
    }

    return args.withPending(next, {
      type: 'draw',
      playerId: nextPlayerId,
      blocking: true,
      label: 'Piocher une course bonus (Espace).',
      data: {
        kind: 'event.changement_de_saison',
        order,
        cursor: nextCursor,
        processed: nextProcessed,
      },
    });
  }

  next = args.appendLog(
    next,
    `[Panier Express] Changement de saison : terminé.`,
  );
  return args.advanceAfterDraw(next);
}

export function continuePanierExpressQueuedDraw(args: {
  state: GameStateEntity;
  queue: Array<{ playerId: number; standId?: string }>;
  cursor: number;
  label: string;
  drawCourse: (
    state: GameStateEntity,
    playerId: number,
    standId?: string,
  ) => GameStateEntity;
  advanceAfterDraw: (state: GameStateEntity) => GameStateEntity;
  withPending: (
    state: GameStateEntity,
    pending: NonNullable<GameStateEntity['pending']>,
  ) => GameStateEntity;
}): GameStateEntity {
  const entry = args.queue[args.cursor];
  if (!entry || !Number.isFinite(entry.playerId)) {
    return args.advanceAfterDraw(args.state);
  }

  let next = args.drawCourse(
    args.state,
    Number(entry.playerId),
    toText(entry.standId).trim() || undefined,
  );
  const nextCursor = args.cursor + 1;
  if (nextCursor < args.queue.length) {
    const nextEntry = args.queue[nextCursor];
    return args.withPending(next, {
      type: 'draw',
      playerId: nextEntry.playerId,
      blocking: true,
      label: args.label,
      data: { kind: 'queue', queue: args.queue, cursor: nextCursor },
    });
  }

  return args.advanceAfterDraw(next);
}

export function buildPanierExpressEventTargets(
  players: Array<{ id: number; username?: string | null }>,
  excludePlayerId: number,
): Array<{ playerId: number; username?: string | null }> {
  return players
    .filter((player) => player.id !== excludePlayerId)
    .map((player) => ({ playerId: player.id, username: player.username }));
}

export function buildPanierExpressEventTargetChoices(
  targets: Array<{ playerId: number; username?: string | null }>,
): string[] {
  return targets
    .map((target) => toText(target.username).trim())
    .filter((name) => name.length > 0);
}
