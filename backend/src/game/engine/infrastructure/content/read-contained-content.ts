import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';

const MAX_CONTAINED_CONTENT_BYTES = 8 * 1024 * 1024;

/** Shared filesystem boundary for packaged assets and external releases. */
export function readContainedContent(root: string, asset: string): string {
  if (
    !asset ||
    asset.includes('\\') ||
    asset.includes(':') ||
    isAbsolute(asset) ||
    asset.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new GameContentValidationError(
      'Chemin de contenu hors release ou jeu',
    );
  }
  try {
    const directory = realpathSync(root);
    const filename = realpathSync(resolve(directory, asset));
    const inside = relative(directory, filename);
    if (
      inside === '..' ||
      inside.startsWith('../') ||
      inside.startsWith('..\\') ||
      isAbsolute(inside)
    ) {
      throw new GameContentValidationError(
        'Chemin de contenu hors release ou jeu',
      );
    }
    const content = readFileSync(filename, 'utf8');
    if (Buffer.byteLength(content, 'utf8') > MAX_CONTAINED_CONTENT_BYTES) {
      throw new GameContentValidationError('Contenu de jeu trop volumineux', {
        asset,
      });
    }
    return content;
  } catch (error) {
    if (error instanceof GameContentValidationError) throw error;
    throw new GameContentValidationError('Fichier de contenu illisible', {
      asset,
    });
  }
}
