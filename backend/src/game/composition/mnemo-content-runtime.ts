import type { GameRuntime } from '../core/application/ports/game-runtime.port';
import { DeclarativeGameRuntime } from '../engine/runtime/declarative-game.runtime';
import { contentBackedRuntime } from '../engine/runtime/content/content-backed-runtime';
import {
  readMnemoQuizCatalog,
  mnemoQuizCatalogPath,
} from './mnemo-quiz-catalog';
import { compileJsonGame } from '../rules/public-api';
import { discoverGameDefinitions } from './game-module-discovery';
import { archivedContent } from '../engine/infrastructure/content/archived-content';

function sourceDefinition() {
  const definition = discoverGameDefinitions().find(
    (entry) => entry.id === 'arche-de-mnemosyne',
  );
  const document = definition?.content?.data;
  if (
    !document ||
    !('patterns' in document) ||
    !Array.isArray(document.patterns)
  )
    throw new Error('Missing quiz definition');
  const patterns: unknown[] = document.patterns;
  const pattern = patterns.find(
    (entry): entry is { kind: string; config: object } =>
      !!entry &&
      typeof entry === 'object' &&
      'kind' in entry &&
      entry.kind === 'simultaneous-quiz' &&
      'config' in entry &&
      !!entry.config &&
      typeof entry.config === 'object',
  );
  const quiz = pattern?.config;
  if (
    !quiz ||
    typeof quiz !== 'object' ||
    !('categories' in quiz) ||
    !('questions' in quiz)
  )
    throw new Error('Missing quiz content');
  return { document, patterns, pattern, quiz };
}

export function mnemoQuizSeed(): object {
  const { quiz } = sourceDefinition();
  return { categories: quiz.categories, questions: quiz.questions };
}

export function mnemoContentRuntime(fallback: GameRuntime) {
  const { document, patterns, pattern, quiz } = sourceDefinition();
  const manifest = {
    code: fallback.gameType,
    engine: fallback.gameType,
    name: fallback.displayName,
    summary: fallback.description ?? '',
    minPlayers: fallback.minPlayers,
    maxPlayers: fallback.maxPlayers,
  };
  const seed = { categories: quiz.categories, questions: quiz.questions };
  let previousCatalog: unknown;
  let previousSource: object;
  return contentBackedRuntime(
    fallback,
    () => {
      const catalogue = readMnemoQuizCatalog(seed);
      if (
        !catalogue ||
        typeof catalogue !== 'object' ||
        !('categories' in catalogue) ||
        !('questions' in catalogue)
      )
        throw new Error('Catalogue Mnémosyne invalide');
      if (catalogue === previousCatalog) return previousSource;
      previousCatalog = catalogue;
      previousSource = {
        ...document,
        patterns: patterns.map((entry) =>
          entry === pattern
            ? {
                ...pattern,
                config: {
                  ...quiz,
                  categories: catalogue.categories,
                  questions: catalogue.questions,
                },
              }
            : entry,
        ),
      };
      return previousSource;
    },
    (source) =>
      new DeclarativeGameRuntime(
        compileJsonGame(manifest, source, undefined, {
          externalContent: false,
        }),
      ),
    archivedContent(`${mnemoQuizCatalogPath()}.versions`),
  );
}
