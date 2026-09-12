import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';

type OrderedValues<T = unknown> = {
  id: string;
  valuesByPlayerId: Record<string, T>;
  valueOrder?: number[];
};

export function submissionValueOrder(
  session: OrderedValues,
): readonly number[] {
  const keys = Object.keys(session.valuesByPlayerId);
  const order = session.valueOrder ?? keys.map(Number);
  const known = new Set(keys);
  if (
    !Array.isArray(order) ||
    order.length !== keys.length ||
    new Set(order).size !== order.length ||
    order.some(
      (id: number) =>
        !Number.isSafeInteger(id) || id === 0 || !known.has(String(id)),
    )
  )
    throw new GameStateViolationError('Invalid submission value order', {
      sessionId: session.id,
    });
  return order;
}

export function orderedSubmissionValues<T>(
  session: OrderedValues<T>,
): Record<string, T> {
  return Object.fromEntries(
    submissionValueOrder(session).map((id) => [
      String(id),
      structuredClone(session.valuesByPlayerId[String(id)]),
    ]),
  );
}

export function recordSubmissionValue<T>(
  session: OrderedValues<T>,
  playerId: number,
  value: T,
): void {
  const order = [...submissionValueOrder(session)];
  if (!Object.hasOwn(session.valuesByPlayerId, String(playerId)))
    order.push(playerId);
  session.valuesByPlayerId[String(playerId)] = structuredClone(value);
  session.valueOrder = order;
}
