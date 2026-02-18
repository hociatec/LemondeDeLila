import { fixMojibakeString } from '../../../common/utils/mojibake';

export function normalizeGameLogMessage(input: unknown): string {
  const raw = String(input ?? '');
  if (!raw) return '';

  const fixed = fixMojibakeString(raw);
  return fixed
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;:.!?])/g, '$1')
    .trim();
}
