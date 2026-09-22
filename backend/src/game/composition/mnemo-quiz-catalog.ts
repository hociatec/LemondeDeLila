import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readEnvironment } from '../../platform/config/public-api';

/** Shared location for the administrative editor and new game sessions. */
export function mnemoQuizCatalogPath(): string {
  const configured = readEnvironment('MNEMO_QUIZ_PATH').trim();
  if (configured) return path.resolve(configured);
  return readEnvironment('NODE_ENV').toLowerCase() === 'production'
    ? path.join(
        os.homedir(),
        '.local',
        'share',
        'lemonde-de-lila',
        'arche-de-mnemosyne',
        'quiz.json',
      )
    : path.resolve(
        process.cwd(),
        'src/game/games/vents-infinis/arche-de-mnemosyne/quiz.json',
      );
}

let cached: { path: string; signature: string; source: unknown } | undefined;

export function readMnemoQuizCatalog(fallback: object): unknown {
  const filePath = mnemoQuizCatalogPath();
  if (!fs.existsSync(filePath)) return structuredClone(fallback);
  const stat = fs.statSync(filePath);
  const signature = `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
  if (cached?.path === filePath && cached.signature === signature)
    return cached.source;
  if (stat.size > 4 * 1024 * 1024)
    throw new Error('Catalogue Mnémosyne trop volumineux');
  const source: unknown = JSON.parse(
    fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''),
  );
  cached = { path: filePath, signature, source };
  return source;
}
