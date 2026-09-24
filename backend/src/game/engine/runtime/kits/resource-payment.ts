import type {
  InsufficientResourcePolicy,
  ResourcePayment,
} from '../contracts/resource-payment';
import { GameRuleViolationError } from '../contracts/game-domain.errors';
import { assertGameValue } from './numeric-invariants';

/** Pure quote shared by affordability, settlement and insufficient-funds rules. */
export function quoteResourcePayment(
  balance: number,
  amount: number,
  policy: InsufficientResourcePolicy = 'cancel',
): ResourcePayment {
  assertGameValue(balance);
  assertGameValue(amount);
  if (
    amount < 0 ||
    !['cancel', 'debt', 'partial', 'eliminate'].includes(policy)
  )
    throw new GameRuleViolationError('RESOURCE_AMOUNT_INVALID');
  const available = Math.max(0, balance);
  const shortfall = Math.max(0, amount - available);
  const accepted = shortfall === 0 || policy !== 'cancel';
  const paid = !accepted
    ? 0
    : policy === 'debt'
      ? amount
      : Math.min(amount, available);
  const next = balance - paid;
  assertGameValue(next);
  return {
    accepted,
    paid,
    shortfall,
    balance: next,
    eliminate: shortfall > 0 && policy === 'eliminate',
  };
}
