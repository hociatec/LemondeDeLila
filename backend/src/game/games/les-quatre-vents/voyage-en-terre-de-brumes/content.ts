import {
  freezeGameContent,
  gameEffects,
  rejectContent,
} from '../../../core/application/public-api';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  VoyageCard,
  VoyageCollectionKind,
  VoyageQuiz,
  VoyageTile,
  VoyageTileType,
} from './state';

type RawVoyageCard = Omit<
  VoyageCard,
  'effects' | 'collectionGain' | 'discardAfterResolve' | 'quiz'
>;
type RawVoyageTile = Omit<VoyageTile, 'passageEffect'>;

type VoyageContent = {
  tiles: VoyageTile[];
  legend: VoyageCard[];
  farce: VoyageCard[];
  treasure: VoyageCard[];
  landscape: VoyageCard[];
};

export const VOYAGE_CONTENT = loadContent();

function loadContent(): VoyageContent {
  const directory = contentDirectory();
  return {
    tiles: readArray(directory, 'board.json', 'tiles', isTile).map(
      decorateTile,
    ),
    legend: readCards(directory, 'legend-cards.json', 'legend'),
    farce: readCards(directory, 'farce-cards.json', 'farce'),
    treasure: readCards(directory, 'treasure-cards.json', 'treasure'),
    landscape: readCards(directory, 'landscape-cards.json', 'landscape'),
  };
}

function readCards(
  directory: string,
  filename: string,
  kind: VoyageCollectionKind,
): VoyageCard[] {
  return readArray(directory, filename, 'cards', isCard).map((card) =>
    decorateCard(card, kind),
  );
}

function readArray<T>(
  directory: string,
  filename: string,
  field: string,
  guard: (value: unknown) => value is T,
): T[] {
  const raw: unknown = JSON.parse(
    readFileSync(resolve(directory, filename), 'utf8').replace(/^\uFEFF/, ''),
  );
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw[field])) {
    rejectContent(`Contenu Voyage invalide: ${filename}`);
  }
  const values = raw[field];
  if (values.length === 0 || !values.every(guard)) {
    rejectContent(`Entrées Voyage invalides: ${filename}`);
  }
  return values;
}

function contentDirectory(): string {
  const candidates = [
    resolve(__dirname, 'model/content'),
    resolve(
      process.cwd(),
      'src/game/games/les-quatre-vents/voyage-en-terre-de-brumes/model/content',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/les-quatre-vents/voyage-en-terre-de-brumes/model/content',
    ),
  ];
  const found = candidates.find((directory) =>
    existsSync(resolve(directory, 'board.json')),
  );
  if (!found) rejectContent('Contenu Voyage en Terre de Brumes introuvable');
  return found;
}

function isTile(value: unknown): value is RawVoyageTile {
  if (!isRecord(value)) return false;
  const types: VoyageTileType[] = [
    'start',
    'finish',
    'neutral',
    'rest',
    'passage',
    'legend',
    'farce',
    'treasure',
    'landscape',
  ];
  return (
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    isTileType(value.type, types) &&
    (value.label == null || typeof value.label === 'string') &&
    (value.description == null || typeof value.description === 'string')
  );
}

function isTileType(
  value: unknown,
  types: readonly VoyageTileType[],
): value is VoyageTileType {
  return typeof value === 'string' && types.some((type) => type === value);
}

function decorateTile(tile: RawVoyageTile): VoyageTile {
  if (tile.type !== 'passage') return tile;
  const description = tile.description ?? '';
  if (/\béchange\b/i.test(description)) {
    return { ...tile, passageEffect: { kind: 'swap-position' } };
  }
  const delta = extractMoveDelta(description);
  return delta === 0
    ? tile
    : { ...tile, passageEffect: { kind: 'move', delta } };
}

function isCard(value: unknown): value is RawVoyageCard {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.effect === 'string'
  );
}

function decorateCard(
  card: RawVoyageCard,
  kind: VoyageCollectionKind,
): VoyageCard {
  const quiz = kind === 'legend' ? parseQuiz(card.effect) : null;
  const keep =
    kind === 'legend' ||
    kind === 'treasure' ||
    (kind === 'landscape'
      ? !/défauss/i.test(card.effect)
      : /gardez|conservez/i.test(card.effect));
  return {
    ...card,
    effects: quiz ? [] : cardInstructions(card.effect),
    collectionGain: quiz ? null : keep ? kind : null,
    discardAfterResolve: !quiz && !keep,
    ...(quiz ? { quiz } : {}),
  };
}

function cardInstructions(text: string): VoyageCard['effects'] {
  if (
    /choisissez\s+un\s+joueur/i.test(text) &&
    /perd\s+son\s+prochain\s+tour/i.test(text)
  ) {
    return [
      gameEffects.custom('voyage.schedule-target', {
        effect: 'skip-turn',
        count: 1,
      }),
    ];
  }
  if (/tirez\s+au\s+hasard\s+une\s+carte/i.test(text) && /perdez/i.test(text)) {
    const allowed = (
      ['legend', 'farce', 'treasure', 'landscape'] as const
    ).filter(
      (kind) =>
        !/l[ée]gende|paysage|tr[ée]sor|farce/i.test(text) ||
        new RegExp(kind === 'landscape' ? 'paysage' : kind, 'i').test(text),
    );
    return [gameEffects.custom('voyage.lose-random-card', { allowed })];
  }
  const delta = extractMoveDelta(text);
  if (delta !== 0) return [gameEffects.custom('voyage.move', { delta })];
  const skip = extractSkipTurns(text);
  if (skip > 0) return [gameEffects.skipTurn(skip)];
  if (/échange/i.test(text) && /carte/i.test(text)) {
    return [
      gameEffects.custom('voyage.schedule-target', {
        effect: 'swap-card',
        count: extractCardCount(text),
      }),
    ];
  }
  if (/échange/i.test(text) && /position|place/i.test(text)) {
    return /dernier\s+joueur/i.test(text)
      ? [gameEffects.custom('voyage.swap-last-player')]
      : [
          gameEffects.custom('voyage.schedule-target', {
            effect: 'swap-position',
            count: 1,
          }),
        ];
  }
  return [];
}

function parseQuiz(text: string): VoyageQuiz | null {
  const lines = text
    .split(/\s*(?=[*]?[ABC]\))/i)
    .map((line) => line.trim())
    .filter((line) => /^[*]?[ABC]\)/i.test(line));
  const answerLine = lines.find((line) => line.startsWith('*'));
  if (lines.length < 2 || !answerLine) return null;
  const clean = (line: string) => line.replace(/^[*]?[ABC]\)\s*/i, '').trim();
  return {
    choices: lines.map(clean),
    answer: clean(answerLine),
    successDelta: extractMoveDelta(text),
  };
}

function extractMoveDelta(text: string): number {
  const words: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
  };
  const match = text.match(
    /(avance(?:z)?|recule(?:z)?)\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (!match) return 0;
  const amount = Number(match[2]) || words[match[2].toLowerCase()] || 0;
  return /^recule/i.test(match[1]) ? -amount : amount;
}

function extractSkipTurns(text: string): number {
  if (/passez trois tours/i.test(text)) return 3;
  if (/passez deux tours/i.test(text)) return 2;
  return /perdez votre prochain tour|passez votre tour|passe ton prochain tour/i.test(
    text,
  )
    ? 1
    : 0;
}

function extractCardCount(text: string): number {
  if (/\b3\b|\btrois\b/i.test(text)) return 3;
  return /\b2\b|\bdeux\b/i.test(text) ? 2 : 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

freezeGameContent(VOYAGE_CONTENT);
