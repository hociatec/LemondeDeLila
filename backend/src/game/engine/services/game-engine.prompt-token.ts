export function normalizePromptToken(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function extractPawnPromptToken(message: string): string | null {
  const text = String(message ?? '').trim();
  if (!text) return null;

  const withPlayer =
    /^c['’]est à (.+?) de choisir (?:son|un) pion(?:[.,!?]|$)/i.exec(text);
  if (!withPlayer) return null;
  return `prompt:choose-pawn:${normalizePromptToken(withPlayer[1])}`;
}
