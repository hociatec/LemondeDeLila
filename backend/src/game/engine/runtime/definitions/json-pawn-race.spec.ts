import { compileJsonGame } from './json-game-compiler';
import { testGame } from '../../../core/testing/game-test-kit';
import manifest from '../../../games/les-quatre-vents/odyssee-quatre-cieux/manifest.json';
import document from '../../../games/les-quatre-vents/odyssee-quatre-cieux/game.json';

it.each<{ name: string; change: (value: typeof document) => void }>([
  {
    name: 'unknown pawn set',
    change: (value) => {
      value.pawnRace.setId = 'missing';
    },
  },
  {
    name: 'unknown dice',
    change: (value) => {
      value.pawnRace.diceId = 'missing';
    },
  },
  {
    name: 'arrival outside the track',
    change: (value) => {
      value.pawnRace.finishAt = 62;
    },
  },
  {
    name: 'unreachable extra turn roll',
    change: (value) => {
      value.pawnRace.extraTurnRolls = [7];
    },
  },
  {
    name: 'insufficient pawn capacity',
    change: (value) => {
      value.patterns[0].pawns.splice(1);
    },
  },
  {
    name: 'reserved choice',
    change: (value) => {
      value.pawnRace.choiceId = 'engine.reserved';
    },
  },
  ...(['initialPosition', 'entryPosition', 'homeStretchFrom'] as const).map(
    (field) => ({
      name: `${field} outside the pawn track`,
      change: (value: typeof document) => {
        value.patterns[0][field] = value.patterns[0].spaces;
      },
    }),
  ),
])('rejects $name before starting', ({ change }) => {
  const invalid = structuredClone(document);
  change(invalid);
  expect(() => compileJsonGame(manifest, invalid)).toThrow();
});

it('keeps a legal move choice private and rejects a forged destination without mutation', async () => {
  const game = await testGame(compileJsonGame(manifest, document))
    .players(2)
    .seed(1)
    .start();
  // Reach a six using real deterministic rolls, without replacing the dice kit.
  for (let count = 0; count < 100 && !game.state().pending; count++) {
    const actor = game.state().turn?.currentPlayerId;
    if (actor == null) throw new Error('Missing actor');
    await game.as(actor).do('roll', {});
  }
  const state = game.state();
  const actor = state.pending?.playerId;
  if (actor == null) throw new Error('Expected a pawn choice');
  await expect(
    game.as(actor).do('choice.resolve', {
      value: { pawnId: '0:0', from: -1, to: 61, distance: 62, roll: 6 },
    }),
  ).rejects.toThrow();
  expect(game.state()).toEqual(state);
  expect(game.view(actor === 1 ? 2 : 1)).not.toHaveProperty('pending.choices');
});
