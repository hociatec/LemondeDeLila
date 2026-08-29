import {
  freezeGameContent,
  gameEffects,
  rejectContent,
} from '../../../engine/sdk/public-api';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  MissionGalaxieChoiceCard,
  MissionGalaxieEventCard,
  MissionGalaxieEventEffect,
  MissionGalaxieTile,
  MissionGalaxieTileType,
} from './types';

export const MISSION_GALAXIE_CONTENT = loadContent();

type RawEventCard = Omit<MissionGalaxieEventCard, 'effects' | 'moveDeltas'> & {
  effect: MissionGalaxieEventEffect;
};

function loadContent(): {
  tiles: MissionGalaxieTile[];
  questions: MissionGalaxieChoiceCard[];
  challenges: MissionGalaxieChoiceCard[];
  events: MissionGalaxieEventCard[];
} {
  const directory = contentDirectory();
  const events = readArray(directory, 'events.json', 'events', isEventCard);
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
    events: events.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      effects: eventInstructions(card),
      ...(card.effect.kind === 'choosePlayerMove'
        ? { moveDeltas: card.effect.deltas }
        : {}),
    })),
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
    rejectContent(`Contenu Mission Galaxie invalide: ${filename}`);
  }
  const values = raw[field];
  if (values.length === 0 || !values.every(guard)) {
    rejectContent(`Entrées Mission Galaxie invalides: ${filename}`);
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
  if (!found) rejectContent('Contenu Mission Galaxie introuvable');
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
    isTileType(value.type, types) &&
    optionalNumber(value.delta) &&
    optionalNumber(value.turnsToSkip) &&
    optionalNumber(value.target) &&
    (value.keepTurn == null || typeof value.keepTurn === 'boolean')
  );
}

function isTileType(
  value: unknown,
  types: readonly MissionGalaxieTileType[],
): value is MissionGalaxieTileType {
  return typeof value === 'string' && types.some((type) => type === value);
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

function isEventCard(value: unknown): value is RawEventCard {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    isEffect(value.effect)
  );
}

function eventInstructions(
  card: RawEventCard,
): MissionGalaxieEventCard['effects'] {
  const effect = card.effect;
  if (effect.kind === 'none') return [];
  if (effect.kind === 'move') {
    return [
      gameEffects.custom('mission-galaxie.move', { delta: effect.delta }),
    ];
  }
  if (effect.kind === 'skip') return [gameEffects.skipTurn(effect.turns)];
  if (effect.kind === 'reroll' || effect.kind === 'keepTurn') {
    return [gameEffects.extraTurn()];
  }
  if (effect.kind === 'goto') {
    return [
      gameEffects.custom('mission-galaxie.goto', { target: effect.target }),
    ];
  }
  if (effect.kind === 'skipOthers') {
    return [
      gameEffects.skipTurn(effect.turns, gameEffects.target.allOpponents()),
    ];
  }
  return [
    gameEffects.custom('mission-galaxie.choose-player-move', {
      cardId: card.id,
      deltas: effect.deltas,
    }),
  ];
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

freezeGameContent(MISSION_GALAXIE_CONTENT);
