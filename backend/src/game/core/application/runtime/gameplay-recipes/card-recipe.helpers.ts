export function cardEventIdentity(card: unknown): Record<string, unknown> {
  if (card == null || typeof card !== 'object' || !('id' in card)) return {};
  const id = (card as { id?: unknown }).id;
  return typeof id === 'string' || typeof id === 'number' ? { cardId: id } : {};
}
