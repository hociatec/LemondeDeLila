import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  AventureCard,
  AventurePawn,
  AventureTile,
  AventureTileType,
} from './state';

const TILE_TYPES: AventureTileType[] = [
  'neutral',
  'neutral',
  'animal',
  'neutral',
  'patte',
  'animal',
  'neutral',
  'animal',
  'patte',
  'animal',
  'neutral',
  'animal',
  'patte',
  'neutral',
  'animal',
  'patte',
  'animal',
  'neutral',
  'animal',
  'patte',
  'neutral',
  'animal',
  'patte',
  'animal',
  'neutral',
  'animal',
  'patte',
  'animal',
  'patte',
  'finish',
];

export const AVENTURE_TILES: AventureTile[] = TILE_TYPES.map((type, index) => ({
  type,
  label:
    type === 'animal'
      ? 'Animal rigolo'
      : type === 'patte'
        ? 'Coup de patte'
        : type === 'finish'
          ? 'La mare — arrivée'
          : index === 0
            ? 'Départ de la jungle'
            : `Sentier ${index + 1}`,
}));

export const AVENTURE_ANIMAL_CARDS = makeCards('animal', [
  { moveDelta: 2 },
  { moveDelta: -1 },
  { moveDelta: 3 },
  { reroll: true },
  { skipTurns: 1 },
  { moveDelta: 1 },
  { moveDelta: 1 },
  { moveDelta: 2 },
  { moveDelta: 1 },
  { skipTurns: 1 },
  { moveDelta: 2 },
  { moveDelta: 3 },
  { moveDelta: 1 },
  { moveDelta: 1 },
  { moveDelta: 1 },
  { moveDelta: 2 },
  {},
  { moveDelta: 1 },
  { moveDelta: 3 },
  { skipTurns: 1 },
]);

export const AVENTURE_PATTE_CARDS = makeCards('patte', [
  { skipTurns: 1 },
  { moveDelta: -1 },
  { skipTurns: 1 },
  { moveDelta: -1 },
  { skipTurns: 1 },
  { skipTurns: 1 },
  { skipTurns: 1 },
  { skipTurns: 1 },
  { skipTurns: 1 },
  { moveDelta: -1 },
]);

export const AVENTURE_PAWNS = loadPawns();

function makeCards(
  deck: AventureCard['deck'],
  effects: Array<Pick<AventureCard, 'moveDelta' | 'skipTurns' | 'reroll'>>,
): AventureCard[] {
  return effects.map((effect, index) => ({
    id: index + 1,
    deck,
    text: `${deck === 'animal' ? 'Rencontre animale' : 'Coup de patte'} ${index + 1}`,
    ...effect,
  }));
}

function loadPawns(): AventurePawn[] {
  const directory = contentDirectory();
  const raw: unknown = JSON.parse(
    readFileSync(resolve(directory, 'pawns.json'), 'utf8').replace(
      /^\uFEFF/,
      '',
    ),
  );
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.pawns)) {
    throw new Error('Pions Aventure Sauvage invalides');
  }
  const pawns = raw.pawns;
  if (pawns.length < 6 || !pawns.every(isPawn)) {
    throw new Error('Catalogue de pions Aventure Sauvage invalide');
  }
  return pawns.map((pawn) => ({
    id: pawn.id,
    label: pawn.name,
    description: pawn.description,
  }));
}

function contentDirectory(): string {
  const candidates = [
    resolve(__dirname, 'model/content'),
    resolve(
      process.cwd(),
      'src/game/games/les-quatre-vents/aventure-sauvage/model/content',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/les-quatre-vents/aventure-sauvage/model/content',
    ),
  ];
  const found = candidates.find((directory) =>
    existsSync(resolve(directory, 'pawns.json')),
  );
  if (!found) throw new Error('Contenu Aventure Sauvage introuvable');
  return found;
}

function isPawn(value: unknown): value is {
  id: string;
  name: string;
  description: string;
} {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
