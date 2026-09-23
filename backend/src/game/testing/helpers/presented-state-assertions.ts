/** Checked readers for intentionally partial presenter fixtures; never assert a full runtime view. */
export function testRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a presented object');
  return value as Record<string, unknown>;
}

export function presentedEvents(value: unknown) {
  const events = testRecord(value);
  if (!Array.isArray(events.recent)) throw new Error('Expected recent events');
  const event = (value: unknown) => {
    const record = testRecord(value);
    return { ...record, data: testRecord(record.data) };
  };
  const recent: unknown[] = events.recent;
  return {
    recent: recent.map(event),
    latestByType: Object.fromEntries(
      Object.entries(testRecord(events.latestByType)).map(([key, value]) => [
        key,
        event(value),
      ]),
    ),
  };
}

export function presentedSystem(value: unknown) {
  const system = testRecord(value);
  return {
    ...system,
    shortcuts: system.shortcuts,
    events: presentedEvents(system.events),
  };
}

export function presentedPending(value: unknown) {
  const pending = testRecord(value);
  return { ...pending, data: testRecord(pending.data) };
}
