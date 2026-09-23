import { compileJsonGame } from '../../../rules/public-api';
import { testGame } from '../../../engine/testing/public-api';
import type { GameEffectInstruction } from '../../../engine/runtime/contracts/effect-ir';
import type { DeclarativeState } from '../../../engine/runtime/state/declarative-state';
import manifest from '../../../games/les-quatre-vents/ca-derape/manifest.json';
import rally from '../../fixtures/second-game-attempts/checkpoint-rally.json';

function candidate(
  effects?: GameEffectInstruction[],
  overshoot = 'wrap',
  primitive = false,
  external = false,
) {
  return compileJsonGame(
    { ...manifest, code: 'checkpoint-rally', engine: 'checkpoint-rally' },
    {
      ...rally,
      extensions: primitive
        ? []
        : rally.extensions.map((entry) => ({
            ...entry,
            config: {
              ...entry.config,
              victoryMode: external ? 'external' : 'arrival',
            },
          })),
      victory:
        primitive || external
          ? rally.victory
          : { kind: 'by-directional-hazard-race' },
      patterns: [{ ...rally.patterns[0], overshoot }],
      ...(effects ? { actions: { advance: { effects } } } : {}),
    },
  );
}

async function started(
  effects?: GameEffectInstruction[],
  overshoot?: string,
  primitive = false,
  external = false,
) {
  const game = testGame(candidate(effects, overshoot, primitive, external))
    .players(['A', 'B', 'C'])
    .seed(91);
  await game.start();
  return game;
}

function snapshot(game: Awaited<ReturnType<typeof started>>) {
  return game.state() as DeclarativeState<object>;
}

describe('checkpoint rally: a second-game attempt, not a reuse certification', () => {
  it('compiles the independent points objective with the hazard extension', () => {
    expect(() =>
      compileJsonGame(
        { ...manifest, code: 'checkpoint-rally', engine: 'checkpoint-rally' },
        rally,
      ),
    ).not.toThrow();
  });
  it.each([
    ['external', 'by-directional-hazard-race'],
    ['arrival', 'resource-at-least'],
    [undefined, 'resource-at-least'],
  ])('rejects conflicting victory mode %s with %s', (mode, kind) => {
    const config: Record<string, unknown> = { ...rally.extensions[0].config };
    delete config.victoryMode;
    if (mode) config.victoryMode = mode;
    expect(() =>
      compileJsonGame(manifest, {
        ...rally,
        victory: kind === 'resource-at-least' ? rally.victory : { kind },
        extensions: [{ type: 'directionalHazardRace', config }],
      }),
    ).toThrow('game.json.victory.kind');
  });
  it('exposes the pack finish rule before any checkpoint is earned', async () => {
    const game = await started();
    await game.as(1).do('advance', {});
    expect(snapshot(game).engine.match.result).toEqual({
      winnerPlayerIds: [1],
      reason: 'finish-line',
    });
    expect(snapshot(game).engine.playerValues.resources.checkpoints['1']).toBe(
      0,
    );
    expect(await game.replay()).toEqual(game.state());
  });

  it('still draws and resolves hazards at the former finish position', async () => {
    const card = {
      ...rally.extensions[0].config.cards[0],
      effects: [{ kind: 'gain-resource', resource: 'checkpoints', amount: 1 }],
    };
    const document = {
      ...rally,
      components: [{ ...rally.components[0], cards: [card] }],
      extensions: [
        {
          ...rally.extensions[0],
          config: {
            ...rally.extensions[0].config,
            cards: [card],
            tiles: rally.extensions[0].config.tiles.map((tile) => ({
              ...tile,
              isNeutral: false,
            })),
          },
        },
      ],
    };
    const game = testGame(compileJsonGame(manifest, document))
      .players(['A', 'B', 'C'])
      .seed(91);
    await game.start();
    await game.as(1).do('advance', {});
    expect(snapshot(game).engine.playerValues.resources.checkpoints['1']).toBe(
      1,
    );
    expect(snapshot(game).engine.match.status).toBe('playing');
    expect(await game.replay()).toEqual(game.state());
  });

  it.each([false, true])(
    'three circuits complete only the points objective (primitive=%s)',
    async (primitive) => {
      const game = await started(
        [
          ...((primitive
            ? [{ kind: 'move', trackId: 'directionalHazard', spaces: 1 }]
            : [
                {
                  kind: 'custom',
                  effectId: 'race-hazard.move',
                  data: { delta: 1 },
                },
                {
                  kind: 'custom',
                  effectId: 'race-hazard.mark-winner',
                  data: {},
                },
              ]) satisfies GameEffectInstruction[]),
          {
            kind: 'conditional',
            condition: {
              kind: 'track-position',
              trackId: 'directionalHazard',
              position: 0,
            },
            then: [
              { kind: 'gain-resource', resource: 'checkpoints', amount: 1 },
            ],
          },
        ],
        'wrap',
        primitive,
        true,
      );
      for (let step = 1; step <= 14; step++) {
        await game.as(1).do('advance', {});
        expect(snapshot(game).engine.match.status).toBe(
          step < 14 ? 'playing' : 'finished',
        );
      }
      expect(
        snapshot(game).engine.playerValues.resources.checkpoints['1'],
      ).toBe(3);
      expect(snapshot(game).engine.match.result?.winnerPlayerIds).toEqual([1]);
      expect(await game.replay()).toEqual(game.state());
    },
  );
});

describe('hazard movements compose the track overshoot policy', () => {
  it.each([
    ['wrap', 0],
    ['bounce', 4],
    ['exact', 4],
    ['clamp', 5],
  ])('%s: individual and collective moves agree', async (policy, expected) => {
    for (const effects of [
      [{ kind: 'custom', effectId: 'race-hazard.move', data: { delta: 2 } }],
      [
        {
          kind: 'custom',
          effectId: 'race-hazard.global',
          data: { effect: 'advance-all' },
        },
      ],
    ] satisfies GameEffectInstruction[][]) {
      const game = await started(effects, String(policy));
      await game.as(1).do('advance', {});
      expect(
        snapshot(game).engine.kits.movement?.positions.directionalHazard['1'],
      ).toBe(expected);
      expect(await game.replay()).toEqual(game.state());
    }
  });

  it('collective retreat wraps below zero', async () => {
    const game = await started([
      {
        kind: 'custom',
        effectId: 'race-hazard.global',
        data: { effect: 'retreat-all' },
      },
    ]);
    await game.as(1).do('advance', {});
    expect(
      snapshot(game).engine.kits.movement?.positions.directionalHazard['2'],
    ).toBe(4);
    expect(await game.replay()).toEqual(game.state());
  });

  it('random collective movement uses the circuit policy too', async () => {
    const game = await started([
      { kind: 'move-to', trackId: 'directionalHazard', position: 5 },
      {
        kind: 'custom',
        effectId: 'race-hazard.global',
        data: { effect: 'random-roll-all' },
      },
    ]);
    await game.as(1).do('advance', {});
    expect(
      snapshot(game).engine.kits.movement?.positions.directionalHazard['1'],
    ).toBe(0);
    expect(await game.replay()).toEqual(game.state());
  });
});
