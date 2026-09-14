function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function withoutRepeatedTurnAnnouncements(
  events: Record<string, unknown>[],
): Record<string, unknown>[] {
  let previousLastLine = '';
  return events.map((event) => {
    const data = asRecord(event.data);
    const message =
      typeof data.message === 'string'
        ? data.message.trim().slice(0, 2_000)
        : '';
    if (!message) return event;
    const lines = message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const isRepeatedTurn =
      lines.length === 1 &&
      lines[0].startsWith("C'est au tour de ") &&
      lines[0] === previousLastLine;
    if (isRepeatedTurn) {
      const remainingData = { ...data };
      delete remainingData.message;
      return { ...event, data: remainingData };
    }
    previousLastLine = lines.at(-1) ?? previousLastLine;
    return event;
  });
}
