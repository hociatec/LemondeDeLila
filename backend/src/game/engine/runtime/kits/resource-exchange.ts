import { GameRuleViolationError } from '../../../core/domain/errors/game-domain.errors';
import {
  assertGamePlayerId,
  assertGameValue,
  assertPlayerValueId,
} from './numeric-invariants';

type Offer = { resource: string; amount: number };
type Change = {
  playerId: number;
  resource: string;
  previous: number;
  value: number;
};

/** Prepare both sides without allocating or mutating resource containers. */
export function prepareResourceExchange(
  resources: Record<string, Record<string, number>>,
  leftPlayerId: number,
  rightPlayerId: number,
  left: Offer,
  right: Offer,
): Change[] {
  assertGamePlayerId(leftPlayerId);
  assertGamePlayerId(rightPlayerId);
  for (const offer of [left, right]) {
    assertPlayerValueId(offer.resource);
    if (!Number.isSafeInteger(offer.amount) || offer.amount < 1)
      throw new GameRuleViolationError('RESOURCE_TRANSFER_AMOUNT');
  }
  if (leftPlayerId === rightPlayerId) return [];
  const changes = new Map<string, Change>();
  const transfer = (from: number, to: number, offer: Offer) => {
    const available = resources[offer.resource]?.[String(from)] ?? 0;
    assertGameValue(available);
    if (available < offer.amount)
      throw new GameRuleViolationError('RESOURCE_INSUFFICIENT');
    for (const [playerId, delta] of [
      [from, -offer.amount],
      [to, offer.amount],
    ]) {
      const key = `${playerId}:${offer.resource}`;
      const previous = resources[offer.resource]?.[String(playerId)] ?? 0;
      assertGameValue(previous);
      const change = changes.get(key) ?? {
        playerId,
        resource: offer.resource,
        previous,
        value: 0,
      };
      change.value += delta;
      changes.set(key, change);
    }
  };
  transfer(leftPlayerId, rightPlayerId, left);
  transfer(rightPlayerId, leftPlayerId, right);
  for (const change of changes.values()) {
    change.value += change.previous;
    assertGameValue(change.value);
    assertGameValue(change.value - change.previous);
  }
  return [...changes.values()];
}
