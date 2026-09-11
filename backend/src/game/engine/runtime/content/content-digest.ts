import { createHash } from 'node:crypto';
import type { GameContentShape } from './game-content';

/** Computed at compilation; execution compares the stored digest only. */
export function contentDigest(content: GameContentShape): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        encode({
          gameId: content.gameId,
          formatVersion: content.formatVersion ?? 1,
          data: content.data,
        }),
      ),
    )
    .digest('hex');
}

function encode(value: unknown): unknown {
  if (value instanceof Map)
    return [
      'map',
      [...value].map(([key, entry]) => [encode(key), encode(entry)]),
    ];
  if (value instanceof Set) return ['set', [...value].map(encode)];
  if (Array.isArray(value)) return ['array', value.map(encode)];
  if (value !== null && typeof value === 'object')
    return [
      'object',
      Object.keys(value)
        .sort()
        .map((key) => [key, encode(Reflect.get(value, key))]),
    ];
  return [typeof value, Object.is(value, -0) ? '-0' : value];
}
