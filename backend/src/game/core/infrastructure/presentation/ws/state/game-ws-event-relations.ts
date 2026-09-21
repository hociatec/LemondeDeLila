type PairedTurn = { eventId: string; data: Record<string, unknown> };
export type PresentationRelations = {
  suppressedEventIds: ReadonlySet<string>;
  turnByMessageId: ReadonlyMap<string, PairedTurn>;
};

export function withoutDuplicateTurnIdentities(
  events: Record<string, unknown>[],
): Record<string, unknown>[] {
  const seen = new Set<string>();
  return [...events]
    .reverse()
    .map((event) => {
      if (stringValue(event.type) !== 'turn.started') return event;
      const data = asRecord(event.data);
      const playerId = numberValue(data.playerId);
      const turnNumber = numberValue(data.turnNumber);
      if (playerId == null || turnNumber == null) return event;
      const identity = `${playerId}:${turnNumber}`;
      if (!seen.has(identity)) {
        seen.add(identity);
        return event;
      }
      const remainingData = { ...data };
      delete remainingData.message;
      return { ...event, data: remainingData };
    })
    .reverse();
}

export function presentationRelations(
  recentEvents: unknown[],
  latestByType: Record<string, unknown>,
): PresentationRelations {
  const orderedRecent = orderedUniqueEvents(recentEvents);
  const ordered = orderedUniqueEvents([
    ...recentEvents,
    ...Object.values(latestByType),
  ]);
  const suppressedEventIds = new Set<string>();
  const turnByMessageId = new Map<string, PairedTurn>();
  for (let index = 0; index < ordered.length; index += 1) {
    const semantic = asRecord(ordered[index]);
    if (stringValue(semantic.type) !== 'game.message') continue;
    const semanticId = stringValue(semantic.id);
    const key = stringValue(asRecord(semantic.data).key);
    const commandId = eventCommandId(semanticId);
    const replacedTypes = supersededTypes(key);
    if (replacedTypes.length > 0) {
      for (const rawEvent of ordered) {
        const event = asRecord(rawEvent);
        const eventId = stringValue(event.id);
        if (
          eventCommandId(eventId) === commandId &&
          replacedTypes.includes(stringValue(event.type))
        )
          suppressedEventIds.add(eventId);
      }
    }
  }
  for (let index = 0; index < orderedRecent.length; index += 1) {
    const semantic = asRecord(orderedRecent[index]);
    if (stringValue(semantic.type) !== 'game.message') continue;
    const semanticId = stringValue(semantic.id);
    const key = stringValue(asRecord(semantic.data).key);
    if (key !== 'game.card.drawn' && key !== 'game.player.passed') continue;
    for (const rawEvent of orderedRecent.slice(index + 1)) {
      const event = asRecord(rawEvent);
      const type = stringValue(event.type);
      if (type === 'game.message') break;
      if (type !== 'turn.started') {
        if (suppressedEventIds.has(stringValue(event.id))) continue;
        break;
      }
      const eventId = stringValue(event.id);
      turnByMessageId.set(semanticId, {
        eventId,
        data: asRecord(event.data),
      });
      suppressedEventIds.add(eventId);
      break;
    }
  }
  suppressDuplicateLandings(ordered, suppressedEventIds);
  return { suppressedEventIds, turnByMessageId };
}

function suppressDuplicateLandings(
  events: Record<string, unknown>[],
  suppressedEventIds: Set<string>,
): void {
  const bestByLanding = new Map<
    string,
    { eventId: string; narrationScore: number }
  >();
  for (const event of events) {
    if (stringValue(event.type) !== 'pawn.landed') continue;
    const eventId = stringValue(event.id);
    const data = asRecord(event.data);
    const playerId = numberValue(data.playerId);
    const position = numberValue(data.position);
    if (!eventId || playerId == null || position == null) continue;
    const identity = `${eventCommandId(eventId)}:${playerId}:${position}`;
    const narrationScore =
      Number(Boolean(stringValue(data.tileLabel))) +
      Number(Boolean(stringValue(data.tileDescription)));
    const previous = bestByLanding.get(identity);
    if (!previous) {
      bestByLanding.set(identity, { eventId, narrationScore });
      continue;
    }
    if (narrationScore >= previous.narrationScore) {
      suppressedEventIds.add(previous.eventId);
      bestByLanding.set(identity, { eventId, narrationScore });
    } else {
      suppressedEventIds.add(eventId);
    }
  }
}

function orderedUniqueEvents(events: unknown[]): Record<string, unknown>[] {
  const unique = new Map<string, Record<string, unknown>>();
  for (const rawEvent of events) {
    const event = asRecord(rawEvent);
    const id = stringValue(event.id);
    if (id && !unique.has(id)) unique.set(id, event);
  }
  return [...unique.values()].sort((left, right) => {
    const leftSequence = numberValue(left.sequence);
    const rightSequence = numberValue(right.sequence);
    if (leftSequence != null && rightSequence != null)
      return leftSequence - rightSequence;
    return (
      (numberValue(left.occurredAtMs) ?? 0) -
      (numberValue(right.occurredAtMs) ?? 0)
    );
  });
}

function supersededTypes(messageKey: string): string[] {
  if (messageKey === 'game.card.drawn') return ['card.drawn', 'card.received'];
  if (messageKey === 'game.card.played') return ['card.played'];
  if (messageKey === 'game.round.started')
    return [
      'match.started',
      'round.started',
      'turn.started',
      'card.drawn',
      'card.received',
      'card.discarded',
    ];
  return [];
}

function eventCommandId(eventId: string): string {
  const separator = eventId.lastIndexOf(':');
  return separator < 0 ? eventId : eventId.slice(0, separator);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 2_000) : '';
}

function numberValue(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isSafeInteger(number) ? number : null;
}
