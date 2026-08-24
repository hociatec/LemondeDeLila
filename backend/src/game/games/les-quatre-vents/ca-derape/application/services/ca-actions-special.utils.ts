import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import type { CaCard, CaMetadata } from '../../model/ca.types';

export function applyCaSpecialAfterMove(args: {
  state: GameStateEntity;
  actorId: number;
  card: CaCard;
  getMeta: (state: GameStateEntity) => CaMetadata;
  clamp: (value: number, min: number, max: number) => number;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  resolvePlayerName: (state: GameStateEntity, playerId: number) => string;
}): GameStateEntity {
  const { state, actorId, card, getMeta, clamp, appendLog, resolvePlayerName } =
    args;
  if (!card) return state;
  let next = state;
  let meta = getMeta(next);

  const myPos = meta.positions?.[actorId] ?? 0;
  const lastIndex = Math.max(0, (meta.tiles?.length ?? 0) - 1);

  const ids = Object.keys(meta.positions ?? {})
    .map(Number)
    .filter(Number.isFinite);
  const others = ids.filter((id) => id !== actorId);
  const maxPos = others.length
    ? Math.max(...others.map((id) => meta.positions?.[id] ?? 0))
    : myPos;

  if (card.id === 33) {
    const target = clamp(maxPos + 1, 0, lastIndex);
    meta = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [actorId]: target },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    return appendLog(
      next,
      resolvePlayerName(next, actorId) + ' prend la premi?re place.',
    );
  }

  if (card.id === 34) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        ignoreNextPenalty: {
          ...(meta.statuses.ignoreNextPenalty ?? {}),
          [actorId]: true,
        },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (card.id === 35) {
    const positions = { ...(meta.positions ?? {}) };
    const ahead = others
      .map((id) => ({ id, pos: positions[id] ?? 0 }))
      .filter((entry) => entry.pos > myPos)
      .sort((left, right) => left.pos - right.pos)[0];

    if (!ahead) {
      return appendLog(next, 'Saute-mouton : aucun joueur devant.');
    }

    const actorAfter = clamp(ahead.pos + 1, 0, lastIndex);
    const targetAfter = clamp(ahead.pos - 1, 0, lastIndex);
    positions[actorId] = actorAfter;
    positions[ahead.id] = targetAfter;
    meta = { ...meta, positions };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    return appendLog(
      next,
      resolvePlayerName(next, actorId) +
        ' saute au-dessus de ' +
        resolvePlayerName(next, ahead.id) +
        '.',
    );
  }

  if (card.id === 36) {
    let nextMultiple = lastIndex;
    for (let pos = myPos + 1; pos <= lastIndex; pos += 1) {
      if ((pos + 1) % 5 === 0) {
        nextMultiple = pos;
        break;
      }
    }
    meta = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [actorId]: nextMultiple },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    return appendLog(
      next,
      resolvePlayerName(next, actorId) +
        " avance jusqu'à une case multiple de 5.",
    );
  }

  return next;
}

export function drawCaCard(args: {
  meta: CaMetadata;
  drawOne: <TCard, TDeckState extends object>(input: {
    meta: TDeckState;
    deckKey: keyof TDeckState & string;
    discardKey: keyof TDeckState & string;
    rngKey: keyof TDeckState & string;
  }) => {
    card: TCard | null;
    meta: TDeckState;
  };
}): { card: CaCard | null; meta: CaMetadata } {
  const { meta, drawOne } = args;
  const flow = drawOne<
    CaCard,
    { cards: CaCard[]; discard: CaCard[]; rng: CaMetadata }
  >({
    meta: {
      cards: Array.isArray(meta.decks?.cards) ? meta.decks.cards : [],
      discard: Array.isArray(meta.decks?.discard) ? meta.decks.discard : [],
      rng: meta,
    },
    deckKey: 'cards',
    discardKey: 'discard',
    rngKey: 'rng',
  });

  const baseMeta: CaMetadata = {
    ...flow.meta.rng,
    decks: {
      cards: Array.isArray(flow.meta.cards) ? flow.meta.cards : [],
      discard: Array.isArray(flow.meta.discard) ? flow.meta.discard : [],
    },
  };
  if (!flow.card) {
    return { card: null, meta: baseMeta };
  }
  return {
    card: flow.card,
    meta: {
      ...baseMeta,
      decks: {
        cards: baseMeta.decks.cards,
        discard: [...baseMeta.decks.discard, flow.card],
      },
    },
  };
}
