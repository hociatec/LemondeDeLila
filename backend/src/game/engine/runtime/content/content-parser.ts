import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';

const MAX_CONTENT_JSON_BYTES = 8 * 1024 * 1024;

export function decodeContentText(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

export function parseContentJson(
  text: string,
  gameId: string,
  asset = 'content',
): unknown {
  if (
    typeof text !== 'string' ||
    Buffer.byteLength(text, 'utf8') > MAX_CONTENT_JSON_BYTES
  ) {
    throw new GameContentValidationError('JSON de contenu trop volumineux', {
      gameId,
      asset,
    });
  }
  try {
    return JSON.parse(decodeContentText(text)) as unknown;
  } catch {
    throw new GameContentValidationError('JSON de contenu invalide', {
      gameId,
      asset,
    });
  }
}
