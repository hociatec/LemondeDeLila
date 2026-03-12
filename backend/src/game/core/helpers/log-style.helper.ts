import { fixMojibakeString } from '../../../common/utils/mojibake';

function normalizeCommonFrenchTypos(input: string): string {
  return input
    .replace(/\bdebut de partie\b/gi, (raw) =>
      raw[0] === raw[0].toUpperCase() ? 'DÃ©but de partie' : 'dÃ©but de partie',
    )
    .replace(/\blance le de\b/gi, (raw) =>
      raw[0] === raw[0].toUpperCase() ? 'Lance le dÃ©' : 'lance le dÃ©',
    )
    .replace(/\blancez le de\b/gi, (raw) =>
      raw[0] === raw[0].toUpperCase() ? 'Lancez le dÃ©' : 'lancez le dÃ©',
    );
}

function normalizePawnChoiceLogs(input: string): string {
  return input
    .replace(
      /^(.+?) choisit le pion\s*:?\s*(.+)$/i,
      (_raw, who: string, pawn: string) =>
        `${String(who).trim()} a choisi le pion: ${String(pawn).trim()}`,
    )
    .replace(
      /^c['Ã¢â‚¬â„¢]est Ã {2}(.+?) de choisir un pion([.!?])?$/i,
      (_raw, who: string, punct: string | undefined) =>
        `C'est Ã  ${String(who).trim()} de choisir son pion${punct ?? '.'}`,
    )
    .replace(
      /^c['Ã¢â‚¬â„¢]est ÃƒÂ {2}(.+?) de choisir un pion([.!?])?$/i,
      (_raw, who: string, punct: string | undefined) =>
        `C'est Ã  ${String(who).trim()} de choisir son pion${punct ?? '.'}`,
    );
}

function toLogString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function normalizeGameLogMessage(input: unknown): string {
  const raw = toLogString(input);
  if (!raw) return '';

  const fixed = fixMojibakeString(raw);
  const normalized = fixed
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/(?<!\.)\.\.(?!\.)/g, '.')
    .trim();
  return normalizePawnChoiceLogs(normalizeCommonFrenchTypos(normalized));
}
