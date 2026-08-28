import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { discoverGameDefinitions } from '../../composition/game-module-discovery';
import {
  auditGameImportBoundaries,
  auditPhaseReachability,
  repeatedFunctionNames,
} from './backend-debt-auditor';
import {
  cards,
  defineAction,
  defineGame,
  eventTrackGame,
  gameEffects,
  gameInput,
  movement,
  playerView,
} from '../application/public-api';
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
    }
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
