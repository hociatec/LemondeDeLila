export function scalarMessageText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

export function cardMessageLabel(value: unknown): string {
  const scalar = scalarMessageText(value);
  if (scalar) return scalar;
  const card =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return (
    scalarMessageText(card.label) ||
    scalarMessageText(card.name) ||
    scalarMessageText(card.id) ||
    scalarMessageText(card.value)
  );
}
