import { parseStrictInteger } from '../../../../shared/utils/public-api';

export function toPlayerId(value: unknown): number | null {
  return parseStrictInteger(value, { min: 1 });
}
