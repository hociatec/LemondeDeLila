import { createHash } from 'node:crypto';
import type { GameSingleActionDto } from '../models/game-action.model';
import { GameActionRejectedError } from '../../domain/errors/game-domain.errors';
import { assertSerializableState } from '../../../engine/runtime/state/assert-serializable-state';

/** Persist only a versioned digest, never a second copy of private command data. */
export function gameCommandFingerprint(
  action: GameSingleActionDto,
  actorId: number | null,
): string {
  assertSerializableState(action, 'command');
  const meta = Object.fromEntries(
    Object.entries(action.meta ?? {}).filter(
      ([key]) => !['commandId', 'knownVersion', 'actorId'].includes(key),
    ),
  );
  const canonical = JSON.stringify(
    {
      type: action.type,
      actorId,
      hasPayload: action.payload !== undefined,
      payload: action.payload,
      meta,
    },
    (_key, value: unknown): unknown => {
      if (value === null || typeof value !== 'object' || Array.isArray(value))
        return value;
      return Object.fromEntries(
        Object.entries(value).sort(([left], [right]) =>
          left < right ? -1 : left > right ? 1 : 0,
        ),
      );
    },
  );
  if (Buffer.byteLength(canonical, 'utf8') > 1_048_576)
    throw new GameActionRejectedError('Commande trop volumineuse.');
  return `v1:${createHash('sha256').update(canonical).digest('hex')}`;
}
