import {
  freezeGameContent,
  rejectContent,
} from '../../../engine/sdk/public-api';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GoosePawn, GooseTile } from './types';

export const GOOSE_PAWNS: GoosePawn[] = [
  { id: 'coq-rockeur', label: 'Coq rockeur', feminine: false },
  { id: 'vache-artistique', label: 'Vache artistique', feminine: true },
  { id: 'cochon-gourmand', label: 'Cochon gourmand', feminine: false },
  { id: 'poule-scientifique', label: 'Poule scientifique', feminine: true },
  { id: 'chevre-acrobate', label: 'Chèvre acrobate', feminine: true },
  { id: 'marmotte-reveuse', label: 'Marmotte rêveuse', feminine: true },
];

export const GOOSE_TILES = buildTiles(loadTexts());

function loadTexts(): Map<number, { title: string; description: string }> {
  const candidates = [
    resolve(__dirname, 'model/content/descriptions.json'),
    resolve(
      process.cwd(),
      'src/game/games/vents-sacres/jeu-oie/model/content/descriptions.json',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/vents-sacres/jeu-oie/model/content/descriptions.json',
    ),
  ];
  const path = candidates.find(existsSync);
  if (!path) rejectContent('Descriptions du Jeu de l’Oie introuvables');
  const parsed: unknown = JSON.parse(
    readFileSync(path, 'utf8').replace(/^\uFEFF/, ''),
  );
  if (!isRecord(parsed) || !Array.isArray(parsed.cases)) {
    rejectContent('Descriptions du Jeu de l’Oie invalides');
  }
  const texts = new Map<number, { title: string; description: string }>();
  for (const value of parsed.cases) {
    if (!isRecord(value)) continue;
    const index = Number(value.index);
    if (!Number.isInteger(index)) continue;
    texts.set(index, {
      title: typeof value.title === 'string' ? value.title.trim() : '',
      description:
        typeof value.description === 'string' ? value.description.trim() : '',
    });
  }
  return texts;
}

function buildTiles(
  texts: Map<number, { title: string; description: string }>,
): GooseTile[] {
  const goose = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
  return Array.from({ length: 64 }, (_, index) => {
    const text = texts.get(index);
    const base = {
      id: `case-${index}`,
      label: text?.title || `Case ${index}`,
      ...(text?.description ? { description: text.description } : {}),
    };
    if (index === 1) return { ...base, type: 'start' as const };
    if (index === 63) return { ...base, type: 'finish' as const };
    if (index === 6) return { ...base, type: 'bridge' as const };
    if (index === 19) return { ...base, type: 'inn' as const, turnsToSkip: 1 };
    if (index === 26) return { ...base, type: 'magic-die' as const };
    if (index === 31) return { ...base, type: 'well' as const };
    if (index === 42)
      return { ...base, type: 'labyrinth' as const, backTo: 30 };
    if (index === 52)
      return { ...base, type: 'prison' as const, turnsToSkip: 2 };
    if (index === 58) return { ...base, type: 'death' as const, backTo: 1 };
    if (goose.has(index)) return { ...base, type: 'goose' as const };
    return { ...base, type: 'normal' as const };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

freezeGameContent(GOOSE_PAWNS);
freezeGameContent(GOOSE_TILES);
