import { isBoundedJsonInput } from '../../validation/public-api';

/**
 * Wire policy: null is an explicit JSON value; undefined object properties are
 * omitted. Undefined array entries and every non-JSON value are rejected.
 */
export function stringifyExternalJson(value: unknown): string {
  if (!isBoundedJsonInput(value, { allowUndefinedProperties: true })) {
    throw new TypeError('External payload must contain bounded JSON data');
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('External payload must have a JSON representation');
  }
  return serialized;
}
