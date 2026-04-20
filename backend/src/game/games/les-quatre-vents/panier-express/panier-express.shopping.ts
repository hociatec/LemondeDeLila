import { seededShuffle } from '../../../../common/utils/seeded-shuffle';
import type {
  PanierExpressMetadata,
  PanierExpressPlayer,
} from './model/panier-express-state.entity';
import { ensureSeededRng } from '../../../../common/utils/seeded-rng';

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (v == null ? '' : String(v)))
      .filter((v) => v.length > 0);
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => (v == null ? '' : String(v)))
          .filter((v) => v.length > 0);
      }
    } catch {
      /* ignore */
    }
    return value
      .split(/[,;]+/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
}

export function listKey(list: string[]): string {
  return list
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0)
    .join('|');
}

export function buildShoppingList(params: {
  items: string[];
  size: number;
  shuffle: (items: string[]) => string[];
  used?: Set<string>;
}): string[] {
  const { items, size, shuffle, used } = params;
  if (!items.length || size <= 0) return [];

  const attempt = () => {
    const shuffled = shuffle([...items]);
    return shuffled.slice(0, size);
  };

  for (let i = 0; i < 10; i += 1) {
    const candidate = attempt();
    const key = listKey(candidate);
    if (!used || !used.has(key)) {
      used?.add(key);
      return candidate;
    }
  }

  const fallback = attempt();
  const fallbackKey = listKey(fallback);
  if (used && !used.has(fallbackKey)) {
    used.add(fallbackKey);
  }
  return fallback;
}

export function ensureShoppingLists(params: {
  metadata: PanierExpressMetadata;
  players: PanierExpressPlayer[];
  courseItems: string[];
  shoppingListSize: number;
  toStringArray: (value: unknown) => string[];
}): { metadata: PanierExpressMetadata; players: PanierExpressPlayer[] } {
  const { metadata, players, courseItems, shoppingListSize, toStringArray } =
    params;
  const pool = courseItems;
  if (!Array.isArray(pool) || pool.length === 0) {
    return { metadata, players };
  }

  const baseMeta = (metadata ?? {}) as Record<string, unknown>;
  const currentRng =
    baseMeta['rng'] && typeof baseMeta['rng'] === 'object'
      ? (baseMeta['rng'] as any)
      : null;
  const explicitSeedRaw = currentRng?.seed;
  const explicitSeed =
    typeof explicitSeedRaw === 'number'
      ? explicitSeedRaw
      : Number(explicitSeedRaw);

  const hasRoomContext =
    baseMeta['roomId'] != null && baseMeta['roomStartedAt'] != null;
  let seed: number;
  if (Number.isFinite(explicitSeed)) {
    seed = explicitSeed >>> 0;
  } else if (hasRoomContext) {
    seed = ensureSeededRng(baseMeta).seed;
  } else {
    // Fallback déterministe (tests/unit + états hors room context).
    let derived = 1;
    const ids = (Array.isArray(players) ? players : [])
      .map((p) => (typeof (p as any)?.id === 'number' ? (p as any).id : NaN))
      .filter((id) => Number.isFinite(id))
      .sort((a, b) => a - b);
    for (const id of ids) {
      derived = (derived * 31 + ((id as number) >>> 0)) >>> 0;
    }
    seed = derived >>> 0;
  }

  const counterRaw = currentRng?.counter;
  const counter =
    typeof counterRaw === 'number'
      ? counterRaw
      : Math.max(0, Number(counterRaw ?? 0));
  const metaWithRng: PanierExpressMetadata = {
    ...(metadata as any),
    rng: { seed, counter: Number.isFinite(counter) ? counter : 0 },
  };
  const size = Math.min(shoppingListSize, pool.length);
  if (size <= 0) {
    return { metadata: metaWithRng, players };
  }

  const existingMap = asRecord((metaWithRng as any).shoppingLists);
  const outMap: Record<number, string[]> = {};
  const used = new Set<string>();

  const normalizeList = (value: unknown): string[] =>
    toStringArray(value)
      .map((v) => String(v ?? '').trim())
      .filter((v) => v.length > 0)
      .slice(0, size);

  for (const p of players) {
    if (p == null || typeof p.id !== 'number') continue;
    const fromPlayer = normalizeList((p as any).shoppingList);
    const fromMeta = normalizeList(existingMap[String(p.id)]);
    const list = fromPlayer.length > 0 ? fromPlayer : fromMeta;
    if (list.length > 0) {
      outMap[p.id] = list;
      used.add(listKey(list));
    }
  }

  for (const p of players) {
    if (p == null || typeof p.id !== 'number') continue;
    if (outMap[p.id]?.length) continue;

    let chosen: string[] | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const shuffled = seededShuffle(
        pool,
        seed,
        `panier-express:shopping:${p.id}:${attempt}`,
      );
      const candidate = shuffled.slice(0, size);
      const key = listKey(candidate);
      if (!used.has(key)) {
        chosen = candidate;
        used.add(key);
        break;
      }
    }
    if (!chosen) {
      chosen = seededShuffle(
        pool,
        seed,
        `panier-express:shopping:${p.id}:fallback`,
      ).slice(0, size);
    }
    outMap[p.id] = chosen;
  }

  const patchedPlayers = players.map((p) => {
    if (p == null || typeof p.id !== 'number') return p;
    const current = Array.isArray((p as any).shoppingList)
      ? p.shoppingList
      : [];
    if (current.length > 0) {
      return { ...p, shoppingList: normalizeList(current) };
    }
    const restored = outMap[p.id] ?? [];
    return { ...p, shoppingList: restored };
  });

  return {
    metadata: { ...metaWithRng, shoppingLists: outMap },
    players: patchedPlayers,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}
