import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { discoverGameDefinitions } from '../../composition/game-module-discovery';
import {
  auditGameImportBoundaries,
  auditGameStateOwnership,
  auditPhaseReachability,
  gameSpecificState,
  repeatedFunctionNames,
} from './backend-debt-auditor';
import {
  cards,
  defineAction,
  defineGame,
  eventTrackGame,
  GAME_SYSTEM_VIEW_VERSION,
  gameEffects,
  gameInput,
  movement,
  overrideAction,
  playerView,
} from '../application/public-api';
import { GameConfigurationError } from '../domain/errors/game-domain.errors';
import { GameTestKit } from './game-test-kit';

describe('backend debt contracts', () => {
  const definitions = discoverGameDefinitions();

  it('compiles every definition once with diagnostics consumable by tooling', () => {
    for (const definition of definitions) {
      expect(definition.compiled.compiledAt).toBe('defineGame');
      expect(definition.compiled.gameId).toBe(definition.id);
      expect([...definition.compiled.actionIds].sort()).toEqual(
        Object.keys(definition.actions).sort(),
      );
      expect(definition.compiled.componentIds).toEqual(
        (definition.components ?? []).map(
          (component) => `${component.component}:${component.id}`,
        ),
      );
      expect(definition.compiled.actionSources).toBeDefined();
      expect(definition.compiled.componentSources).toBeDefined();
      expect(definition.compiled.lifecycleHookSources).toBeDefined();
    }
  });

  it('projects a versioned generic PlayerView contract even without custom view', async () => {
    const definition = defineGame({
      id: 'default-view-contract',
      displayName: 'Default View Contract',
      category: 'Tests',
      players: { min: 2, max: 2 },
      patterns: [
        eventTrackGame({
          trackId: 'main',
          tiles: [{ id: 0, type: 'start' }],
        }),
      ],
      setup: () => ({ secret: 'server-only' }),
      actions: {},
    });
    const game = await new GameTestKit(definition).players(2).start();
    const view = game.view(1) as unknown as {
      system: object;
      kits: object;
      actionCatalog: object[];
      secret?: unknown;
    };
    expect(view).not.toHaveProperty('secret');
    expect(view.system).toMatchObject({
      version: GAME_SYSTEM_VIEW_VERSION,
      match: expect.any(Object),
      round: expect.any(Object),
      turn: expect.any(Object),
      setup: expect.any(Object),
    });
    expect(view.kits).toMatchObject({
      movement: expect.any(Object),
      dice: expect.any(Object),
      score: expect.any(Object),
    });
    expect(view.actionCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'roll',
          ui: expect.objectContaining({ control: 'button' }),
        }),
      ]),
    );
  });

  it('requires explicit overrideAction when a game replaces a pattern action', () => {
    const pattern = eventTrackGame({
      trackId: 'main',
      tiles: [{ id: 0, type: 'start' }],
    });
    const replacement = defineAction({
      input: gameInput.object({}),
      execute: ({ ctx }) => ctx.turn.complete(),
    });
    expect(() =>
      defineGame({
        id: 'implicit-action-override-contract',
        displayName: 'Implicit Action Override Contract',
        category: 'Tests',
        players: { min: 2, max: 2 },
        patterns: [pattern],
        setup: () => ({}),
        actions: { roll: replacement },
        view: () => playerView({ game: {} }),
      }),
    ).toThrow(GameConfigurationError);
    expect(() =>
      defineGame({
        id: 'explicit-action-override-contract',
        displayName: 'Explicit Action Override Contract',
        category: 'Tests',
        players: { min: 2, max: 2 },
        patterns: [pattern],
        setup: () => ({}),
        actions: {
          roll: overrideAction('roll', {
            input: gameInput.object({}),
            execute: ({ ctx }) => ctx.turn.complete(),
          }),
        },
        view: () => playerView({ game: {} }),
      }),
    ).not.toThrow();
  });

  it('uses only the generated registry for runtime game discovery', () => {
    const source = readFileSync(
      resolve(__dirname, '../../composition/game-module-discovery.ts'),
      'utf8',
    );
    expect(source).toContain('generated-game-registry');
    expect(source).not.toMatch(/readdir|glob|fast-glob|walk/i);
  });

  it('keeps game files behind the public game API boundary', () => {
    expect(
      auditGameImportBoundaries({
        file: 'sample/game.ts',
        source:
          "import { defineGame } from '../../../core/application/public-api';",
      }),
    ).toEqual([]);
    expect(
      auditGameImportBoundaries({
        file: 'sample/game.ts',
        source: "import { InternalStore } from '../../core/private-store';",
      }),
    ).toEqual([
      {
        file: 'sample/game.ts',
        criterion: 'game-import-boundary',
        message: 'Import non autorisé depuis un jeu: ../../core/private-store',
      },
    ]);
    expect(
      gameSources().flatMap((source) => auditGameImportBoundaries(source)),
    ).toEqual([]);
  });

  it('detects kit-owned fields in TState unless explicitly annotated', () => {
    const components = [movement.track({ id: 'main', spaces: 4 })];
    expect(
      auditGameStateOwnership({
        gameId: 'ownership-sample',
        stateSource:
          'export interface OwnershipSampleState {\n  positions: Record<string, number>;\n}\n',
        components,
      }),
    ).toEqual([
      expect.objectContaining({
        criterion: 'state-ownership',
      }),
    ]);
    expect(
      auditGameStateOwnership({
        gameId: 'ownership-sample',
        stateSource:
          'export interface OwnershipSampleState {\n  positions: Record<string, number>;\n}\n',
        components,
        exceptions: gameSpecificState('\\bpositions?\\b'),
      }),
    ).toEqual([]);
  });

  it('provides executable boilerplate metrics and repeated-function detection', () => {
    const files = gameSources().filter((file) =>
      file.file.endsWith('/rules.ts'),
    );
    expect(Array.isArray(repeatedFunctionNames(files, 3))).toBe(true);
  });

  it('detects declared phases unreachable from the initial phase', () => {
    const definition = defineGame({
      id: 'reachability-contract',
      displayName: 'Reachability Contract',
      category: 'Tests',
      players: { min: 2, max: 2 },
      initialPhase: 'start',
      phases: {
        start: { next: 'end' },
        end: {},
        orphan: {},
      },
      setup: () => ({}),
      actions: {
        pass: defineAction({
          input: gameInput.object({}),
          execute: ({ ctx }) => ctx.turn.complete(),
        }),
      },
      view: () => playerView({ game: {} }),
    });
    expect(auditPhaseReachability(definition)).toEqual([
      {
        gameId: 'reachability-contract',
        criterion: 'phase-reachability',
        message: 'Phase inaccessible: orphan',
      },
    ]);
  });

  it('lets patterns install a standard event-track action with generic tile resolution', async () => {
    const definition = defineGame({
      id: 'event-track-contract',
      displayName: 'Event Track Contract',
      category: 'Tests',
      players: { min: 2, max: 2 },
      patterns: [
        eventTrackGame({
          trackId: 'main',
          tiles: [
            { id: 0, type: 'start' },
            ...Array.from({ length: 6 }, (_, index) => ({
              id: index + 1,
              type: 'event',
              effects: [gameEffects.gainScore(1)],
            })),
          ],
        }),
      ],
      setup: () => ({}),
      actions: {},
      view: ({ ctx }) =>
        playerView({
          game: {
            scoreValue: ctx.score.get(ctx.actor?.id ?? 1),
          },
        }),
    });
    const game = await new GameTestKit(definition).seed(1).players(2).start();
    await (
      game.as(1) as { do(type: string, payload: object): Promise<unknown> }
    ).do('roll', {});
    expect(game.view(1).scoreValue).toBe(1);
  });

  it('supports content/session split through frozen referenced catalogues', () => {
    const deck = cards.deck({
      id: 'catalog',
      cards: [{ id: 'a', label: 'A' }],
    });
    const track = movement.track({
      id: 'board',
      spaces: 2,
      landingEffects: { 1: [gameEffects.gainScore(1)] },
    });
    expect(Object.isFrozen(deck.cards)).toBe(true);
    expect(Object.isFrozen(track)).toBe(true);
  });

  it('keeps custom effects data typed at definition boundaries', () => {
    const effect = {
      input: gameInput.object({ amount: gameInput.number({ integer: true }) }),
      apply: jest.fn(),
    };
    expect(effect.input.parse({ amount: 2 })).toEqual({ amount: 2 });
    expect(() => effect.input.parse({ amount: 1.5 })).toThrow();
  });

  it('reports effect queue overflow with source and queued effect kinds', async () => {
    const definition = defineGame({
      id: 'effect-overflow-contract',
      displayName: 'Effect Overflow Contract',
      category: 'Tests',
      players: { min: 2, max: 2 },
      setup: () => ({}),
      actions: {
        overflow: defineAction({
          input: gameInput.object({}),
          execute: ({ ctx }) => {
            ctx.effects.schedule(
              ...Array.from({ length: 300 }, () => gameEffects.gainScore(1)),
            );
          },
        }),
      },
      view: () => playerView({ game: {} }),
    });
    const game = await new GameTestKit(definition).players(2).start();
    await expect(game.as(1).do('overflow', {})).rejects.toMatchObject({
      details: {
        remaining: expect.any(Number),
        queuedKinds: expect.arrayContaining(['gain-score']),
      },
    });
  });
});

function gameSources(): Array<{ file: string; source: string }> {
  const root = resolve(__dirname, '../../games');
  return walkTs(root).map((file) => ({
    file: file.slice(root.length + 1).replaceAll('\\', '/'),
    source: readFileSync(file, 'utf8'),
  }));
}

function walkTs(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const file = resolve(directory, entry);
      const stats = statSync(file);
      if (stats.isDirectory()) return walkTs(file);
      return file.endsWith('.ts') ? [file] : [];
    })
    .sort();
}
