export const DEFAULT_MESSAGE_MAX_LENGTH = 1000;

type SanitizeOptions = {
  encodeHtml?: boolean;
  collapseNewLines?: boolean;
  stripHtml?: boolean;
};

export function sanitizeMessage(
  raw: string,
  options: SanitizeOptions = {},
): string {
  const { encodeHtml = false, collapseNewLines = true, stripHtml = true } =
    options;
  let sanitized = (raw ?? '').trim();
  if (stripHtml) {
    sanitized = sanitized.replace(/<[^>]*>?/gm, '');
  }
  if (collapseNewLines) {
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');
  }
  sanitized = sanitized.trim();
  if (!encodeHtml) {
    return sanitized;
  }
  return sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
