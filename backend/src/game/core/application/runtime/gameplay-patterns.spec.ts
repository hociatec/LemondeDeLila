import { GameConfigurationError } from '../../domain/errors/game-domain.errors';
import { cards } from './cards-kit';
import {
  definePattern,
  composePatterns,
  cardGame,
  eventTrackGame,
  gridGame,
  marketGame,
  raceGame,
  submissionJudgeGame,
} from './gameplay-patterns';
import { clockwise, simultaneous } from './turn-kit';
import {
  defineConfiguration,
  overrideConfiguration,
} from './configuration-kit';
import { gameInput } from './game-input-schema';
import { defineAction, defineGame } from './game-definition';

describe('gameplay pattern composition', () => {
  it('keeps configured pattern instances uniquely identifiable', () => {
    const composed = composePatterns(
      cardGame({ deckId: 'names', handId: 'names', cards: ['a'] }),
      cardGame({ deckId: 'specials', handId: 'specials', cards: ['b'] }),
    );

    expect(composed.ids).toEqual([
      'card-game:names:names',
      'card-game:specials:specials',
    ]);
  });

  it('rejects duplicated pattern ids', () => {
    expect(() =>
      composePatterns(
        definePattern({
          id: 'same',
          mechanics: ['test'],
        }),
        definePattern({
          id: 'same',
          mechanics: ['test'],
        }),
      ),
    ).toThrow(GameConfigurationError);
  });

  it('rejects duplicated component ids produced by patterns', () => {
    expect(() =>
      composePatterns(
        definePattern({
          id: 'first',
          mechanics: ['cards'],
          components: [cards.deck({ id: 'main', cards: ['a'] })],
        }),
        definePattern({
          id: 'second',
          mechanics: ['cards'],
          components: [cards.deck({ id: 'main', cards: ['b'] })],
        }),
      ),
    ).toThrow('composant dupliqué');
  });

  it('rejects incompatible implicit turn policies', () => {
    expect(() =>
      composePatterns(
        definePattern({
          id: 'sequential',
          mechanics: ['turns'],
          turn: clockwise(),
        }),
        definePattern({
          id: 'simultaneous',
          mechanics: ['turns'],
          turn: simultaneous(),
        }),
      ),
    ).toThrow('politiques de tour incompatibles');
  });

  it('rejects duplicated semantic initialization keys from patterns', () => {
    expect(() =>
      composePatterns(
        definePattern({
          id: 'coins-a',
          mechanics: ['economy'],
          initialization: { resources: { coins: 3 } },
        }),
        definePattern({
          id: 'coins-b',
          mechanics: ['economy'],
          initialization: { resources: { coins: 5 } },
        }),
      ),
    ).toThrow('initialisation resource dupliquée');
  });

  it('composes pattern configuration and requires explicit key overrides', () => {
    const noopAction = defineAction<object, Record<string, never>>({
      input: gameInput.object({}),
      execute: () => undefined,
    });
    const configuredPattern = definePattern<object>({
      id: 'configurable-race',
      mechanics: ['config'],
      config: defineConfiguration({
        input: gameInput.object({ target: gameInput.number({ min: 1 }) }),
        defaults: { target: 10 },
      }),
    });
    const extraPattern = definePattern<object>({
      id: 'configurable-rounds',
      mechanics: ['config'],
      config: defineConfiguration({
        input: gameInput.object({ rounds: gameInput.number({ min: 1 }) }),
        defaults: { rounds: 3 },
      }),
    });
    expect(
      composePatterns(configuredPattern, extraPattern).config?.input.parse({
        target: 12,
        rounds: 4,
      }),
    ).toEqual({ target: 12, rounds: 4 });

    const local = defineConfiguration({
      input: gameInput.object({ target: gameInput.number({ min: 2 }) }),
      defaults: { target: 20 },
    });
    expect(() =>
      defineGame({
        id: 'implicit-config-override',
        displayName: 'Implicit config override',
        category: 'Tests',
        players: { min: 1, max: 1 },
        patterns: [configuredPattern],
        config: local,
        actions: { noop: noopAction },
      }),
    ).toThrow('overrideConfiguration');
    expect(() =>
      defineGame({
        id: 'explicit-config-override',
        displayName: 'Explicit config override',
        category: 'Tests',
        players: { min: 1, max: 1 },
        patterns: [configuredPattern],
        config: overrideConfiguration(['target'], local),
        actions: { noop: noopAction },
      }),
    ).not.toThrow();
  });

  it('defines independent contracts for the major reusable patterns', () => {
    const patterns = [
      raceGame({ trackId: 'race', spaces: 8 }),
      cardGame({ deckId: 'deck', handId: 'hand', cards: ['a'] }),
      eventTrackGame({
        trackId: 'events',
        tiles: [{ id: 0, type: 'start' }],
      }),
      gridGame({ boardId: 'grid', width: 3, height: 3, winLength: 3 }),
      marketGame({
        marketId: 'market',
        inventoryId: 'goods',
        items: ['apple'],
        currency: 'coins',
        prices: { apple: 2 },
      }),
      submissionJudgeGame({
        submissionId: 'answers',
        judgeId: 'judge',
      }),
    ];

    for (const pattern of patterns) {
      expect(pattern.id).toEqual(expect.any(String));
      expect(pattern.mechanics.length).toBeGreaterThan(0);
      expect(pattern.components ?? []).toEqual(expect.any(Array));
    }
  });
});
