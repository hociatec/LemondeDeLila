import { compileJsonGame } from './json-game-compiler';
import { testGame } from '../../../core/testing/game-test-kit';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

function definition(assignment = 'round-robin', count = 4, firstPlayer = 1) {
  return compileJsonGame(manifest, {
    ...document,
    components: [
      ...document.components,
      {
        component: 'pawn.set',
        id: 'tokens',
        perPlayer: 2,
        pawns: Array.from({ length: count }, (_, index) => ({
          id: `pawn-${index}`,
        })),
      },
    ],
    setup: {
      ...document.setup,
      firstPlayer,
      pawns: [{ setId: 'tokens', assignment }],
    },
  });
}

it.each([
  ['round-robin', ['pawn-0', 'pawn-2'], ['pawn-1', 'pawn-3']],
  ['grouped', ['pawn-0', 'pawn-1'], ['pawn-2', 'pawn-3']],
])(
  'assigns %s pawns from JSON and replays setup',
  async (mode, left, right) => {
    const game = await testGame(definition(String(mode)))
      .players(2)
      .start();
    expect(game.state()).toHaveProperty(
      'engine.kits.pawns.assignments.tokens',
      {
        '1': left,
        '2': right,
      },
    );
    await game.as(1).do('advance', {});
    expect(await game.replay()).toEqual(game.state());
  },
);

it('uses the persisted RNG for random pawn assignment', async () => {
  const game = await testGame(definition('random')).players(2).seed(41).start();
  const repeated = await testGame(definition('random'))
    .players(2)
    .seed(41)
    .start();
  expect(game.view(1)).toEqual(repeated.view(1));
  await game.as(1).do('advance', {});
  expect(await game.replay()).toEqual(game.state());
});

it('rejects incomplete distributions and an absent first player', async () => {
  await expect(
    testGame(definition('grouped', 3)).players(2).start(),
  ).rejects.toThrow('Pions insuffisants');
  await expect(
    testGame(definition('grouped', 4, 999))
      .players(2)
      .start(),
  ).rejects.toThrow('Premier joueur absent');
});

it('rejects an unknown assignment mode at compilation', () => {
  expect(() => definition('unknown')).toThrow();
});

it('rejects duplicate pawn initialization', () => {
  expect(() =>
    compileJsonGame(manifest, {
      ...document,
      components: [
        ...document.components,
        {
          component: 'pawn.set',
          id: 'tokens',
          perPlayer: 1,
          pawns: [{ id: 'a' }],
        },
      ],
      setup: { pawns: [{ setId: 'tokens' }, { setId: 'tokens' }] },
    }),
  ).toThrow('attribution répétée');
});
