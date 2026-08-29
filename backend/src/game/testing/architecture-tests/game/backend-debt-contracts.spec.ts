import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
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
  definePattern,
  eventTrackGame,
  gameEffects,
  gameInput,
  movement,
  overrideAction,
  overrideComponent,
  overrideInitialization,
  overrideTurn,
  pawns,
  simultaneous,
} from '../../../core/application/public-api';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { GameTestKit } from '../../../core/testing/game-test-kit';
import { DeclarativeGameRuntime } from '../../../core/application/runtime/declarative-game.runtime';
import { GameSimulator } from '../../../core/testing/game-simulator';

describe('backend debt contracts', () => {
  const definitions = discoverGameDefinitions();

  it('compiles every definition once with diagnostics consumable by tooling', () => {
    for (const definition of definitions) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.actions)).toBe(true);
      expect(
        definition.initialization == null ||
          Object.isFrozen(definition.initialization),
      ).toBe(true);
      expect(definition.content.gameId).toBe(definition.id);
      expect(Object.keys(definition.content.data).length).toBeGreaterThan(0);
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
      expect(definition.compiled.phaseSources).toBeDefined();
      expect(definition.compiled.choiceSources).toBeDefined();
      expect(definition.compiled.effectSources).toBeDefined();
      expect(definition.compiled.contentVersion).toBe(
        definition.contentVersion,
      );
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
    expect(
      (game.state() as unknown as { engine: { contentVersion: string } }).engine
        .contentVersion,
    ).toBe(definition.contentVersion);
    expect(definition.content.version).toBe(definition.contentVersion);
    expect(definition.compiled.contentVersion).toBe(definition.contentVersion);
    const view = game.view(1) as unknown as {
      system: object;
      kits: object;
      actionCatalog: object[];
      secret?: unknown;
    };
    expect(view).not.toHaveProperty('secret');
    expect(view.system).toMatchObject({
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

  it('exposes a versioned content manifest through runtime descriptors', () => {
    const definition = defineGame({
      id: 'content-manifest-contract',
      displayName: 'Content Manifest Contract',
      category: 'Tests',
      players: { min: 1, max: 1 },
      setup: () => ({}),
      actions: {
        pass: defineAction({
          input: gameInput.object({}),
          execute: ({ ctx }) => ctx.turn.complete(),
        }),
      },
    });
    const descriptor = new DeclarativeGameRuntime(definition).getDescriptor();
    expect(descriptor.content).toMatchObject({
      gameId: definition.id,
      version: definition.contentVersion,
      sections: ['components'],
    });
  });

  it('keeps patterns optional for atypical games using only actions and kits', async () => {
    const definition = defineGame({
      id: 'no-pattern-contract',
      displayName: 'No Pattern Contract',
      category: 'Tests',
      players: { min: 1, max: 1 },
      setup: () => ({}),
      actions: {
        pass: defineAction({
          input: gameInput.object({}),
          execute: ({ ctx }) => ctx.turn.complete(),
        }),
      },
    });
    const game = await new GameTestKit(definition).players(1).start();
    expect(game.availableActions(1)).toContain('pass');
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
        viewExtension: () => ({}),
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
        viewExtension: () => ({}),
      }),
    ).not.toThrow();
  });

  it('materializes explicit component, pawn, initialization and turn overrides', () => {
    const pattern = definePattern({
      id: 'override-source',
      mechanics: ['movement', 'pawns'],
      components: [
        movement.track({ id: 'main', spaces: 4 }),
        pawns.set({ id: 'tokens', pawns: [{ id: 'old' }] }),
      ],
      initialization: {
        tracks: { main: 0 },
        pawns: [{ setId: 'tokens', assignment: 'round-robin' }],
      },
      turn: simultaneous(),
    });
    const definition = defineGame({
      id: 'compiled-override-contract',
      displayName: 'Compiled Override Contract',
      category: 'Tests',
      players: { min: 2, max: 2 },
      patterns: [pattern],
      components: [
        overrideComponent(movement.track({ id: 'main', spaces: 9 })),
        overrideComponent(pawns.set({ id: 'tokens', pawns: [{ id: 'new' }] })),
      ],
      initialization: overrideInitialization(['tracks.main', 'pawns.tokens'], {
        tracks: { main: 4 },
        pawns: [{ setId: 'tokens', assignment: 'grouped' }],
      }),
      turn: overrideTurn(simultaneous()),
      setup: () => ({}),
      actions: {
        pass: defineAction({
          input: gameInput.object({}),
          execute: ({ ctx }) => ctx.turn.complete(),
        }),
      },
    });

    expect(
      definition.components?.filter(
        (component) =>
          component.component === 'movement.track' && component.id === 'main',
      ),
    ).toHaveLength(1);
    expect(definition.components?.[0]).not.toHaveProperty('overrides');
    expect(definition.initialization?.tracks).toEqual({ main: 4 });
    expect(definition.initialization?.pawns).toEqual([
      { setId: 'tokens', assignment: 'grouped' },
    ]);
    expect(definition.turn).toMatchObject({ kind: 'simultaneous' });
    expect(definition.turn).not.toHaveProperty('overrides');
  });

  it('uses only the generated registry for runtime game discovery', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../composition/game-module-discovery.ts'),
      'utf8',
    );
    expect(source).toContain('generated-game-registry');
    expect(source).not.toMatch(/readdir|glob|fast-glob|walk/i);
  });

  it('keeps game files behind the public game API boundary', () => {
    expect(
      auditGameImportBoundaries({
        file: 'sample/game.ts',
        source: "import { defineGame } from '../../../engine/sdk/public-api';",
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
      viewExtension: () => ({}),
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
      viewExtension: ({ ctx }) => ({
        scoreValue: ctx.score.get(ctx.actor?.id ?? 1),
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
      viewExtension: () => ({}),
    });
    const game = await new GameTestKit(definition).players(2).start();
    await expect(game.as(1).do('overflow', {})).rejects.toMatchObject({
      details: {
        remaining: expect.any(Number),
        queuedKinds: expect.arrayContaining(['gain-score']),
      },
    });
  });

  it('supports deterministic bot simulation and explicit deadlock accounting', async () => {
    const finishDefinition = defineGame({
      id: 'simulation-finish-contract',
      displayName: 'Simulation Finish Contract',
      category: 'Tests',
      players: { min: 1, max: 1 },
      setup: () => ({}),
      actions: {
        finish: defineAction({
          input: gameInput.object({}),
          execute: ({ actor, ctx }) =>
            ctx.match.finish({ winners: [actor.id], reason: 'simulation' }),
        }),
      },
      bot: { choose: () => ({ type: 'finish', payload: {} }) },
    });
    const finishGame = await new GameTestKit(finishDefinition)
      .players(1)
      .start();
    const simulator = new GameSimulator();
    const report = simulator.runMany(
      new DeclarativeGameRuntime(finishDefinition),
      () => finishGame.state(),
      { games: 3, maxCommands: 3, retainResults: true },
    );
    expect(report.finished).toBe(3);
    expect(report.deadlocks).toBe(0);

    const deadlockDefinition = defineGame({
      id: 'simulation-deadlock-contract',
      displayName: 'Simulation Deadlock Contract',
      category: 'Tests',
      players: { min: 1, max: 1 },
      setup: () => ({}),
      actions: {
        hidden: defineAction({
          input: gameInput.object({}),
          available: () => false,
          execute: () => undefined,
        }),
      },
    });
    const deadlockGame = await new GameTestKit(deadlockDefinition)
      .players(1)
      .start();
    expect(
      simulator.run(
        new DeclarativeGameRuntime(deadlockDefinition),
        deadlockGame.state(),
        {
          maxCommands: 3,
        },
      ).status,
    ).toBe('deadlock');
  });
});

function gameSources(): Array<{ file: string; source: string }> {
  const root = resolve(__dirname, '../../../games');
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
