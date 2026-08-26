import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  MissionGalaxieChoiceCard,
  MissionGalaxieEventCard,
  MissionGalaxieEventEffect,
  MissionGalaxieTile,
  MissionGalaxieTileType,
} from './state';

export const MISSION_GALAXIE_CONTENT = loadContent();

function loadContent() {
  const directory = contentDirectory();
  return {
    tiles: readArray(directory, 'board.json', 'tiles', isTile),
    questions: readArray(
      directory,
      'questions.json',
      'questions',
      isChoiceCard,
    ),
    challenges: readArray(
      directory,
      'challenges.json',
      'challenges',
      isChoiceCard,
    ),
    events: readArray(directory, 'events.json', 'events', isEventCard),
  };
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
    throw new Error(`Contenu Mission Galaxie invalide: ${filename}`);
  }
  const values = raw[field];
  if (values.length === 0 || !values.every(guard)) {
    throw new Error(`Entrées Mission Galaxie invalides: ${filename}`);
  }
  return values;
}

function contentDirectory(): string {
  const candidates = [
    resolve(__dirname, 'model/content'),
    resolve(
      process.cwd(),
      'src/game/games/les-quatre-vents/mission-galaxie/model/content',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/les-quatre-vents/mission-galaxie/model/content',
    ),
  ];
  const found = candidates.find((directory) =>
    existsSync(resolve(directory, 'board.json')),
  );
  if (!found) throw new Error('Contenu Mission Galaxie introuvable');
  return found;
}

function isTile(value: unknown): value is MissionGalaxieTile {
  const types: MissionGalaxieTileType[] = [
    'start',
    'neutral',
    'question',
    'challenge',
    'event',
    'move',
    'skip',
    'finish',
    'swapNearest',
    'goto',
  ];
  return (
    isRecord(value) &&
    typeof value.n === 'number' &&
    typeof value.title === 'string' &&
    types.includes(value.type as MissionGalaxieTileType) &&
    optionalNumber(value.delta) &&
    optionalNumber(value.skipTurns) &&
    optionalNumber(value.target) &&
    (value.keepTurn == null || typeof value.keepTurn === 'boolean')
  );
}

function isChoiceCard(value: unknown): value is MissionGalaxieChoiceCard {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.prompt === 'string' &&
    Array.isArray(value.choices) &&
    value.choices.length > 1 &&
    value.choices.every((choice) => typeof choice === 'string') &&
    typeof value.correctIndex === 'number' &&
    value.correctIndex >= 0 &&
    value.correctIndex < value.choices.length &&
    typeof value.correctDelta === 'number' &&
    typeof value.wrongDelta === 'number'
  );
}

function isEventCard(value: unknown): value is MissionGalaxieEventCard {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    isEffect(value.effect)
  );
}

function isEffect(value: unknown): value is MissionGalaxieEventEffect {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  if (
    value.kind === 'none' ||
    value.kind === 'reroll' ||
    value.kind === 'keepTurn'
  ) {
    return true;
  }
  if (value.kind === 'move') return typeof value.delta === 'number';
  if (value.kind === 'skip' || value.kind === 'skipOthers') {
    return typeof value.turns === 'number';
  }
  if (value.kind === 'goto') return typeof value.target === 'number';
  return (
    value.kind === 'choosePlayerMove' &&
    Array.isArray(value.deltas) &&
    value.deltas.every((delta) => typeof delta === 'number')
  );
}

function optionalNumber(value: unknown): boolean {
  return value == null || typeof value === 'number';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
