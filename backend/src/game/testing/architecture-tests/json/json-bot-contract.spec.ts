import { compileJsonGame } from '../../../rules/public-api';
import { DeclarativeGameRuntime } from '../../../engine/runtime/declarative-game.runtime';
import { testGame } from '../../../core/testing/game-test-kit';
import manifest from '../../fixtures/json-course/manifest.json';
import document from '../../fixtures/json-course/game.json';

function botGame(bot: object) {
  return compileJsonGame(manifest, {
    ...document,
    bot,
    phases: { playing: { actions: ['wait', 'advance'], terminal: true } },
    actions: {
      wait: { effects: [] },
      advance: { effects: [{ kind: 'gain-score', amount: 1 }] },
    },
    victory: { kind: 'score-at-least', amount: 99 },
  });
}

it('selects an explicitly scored legal action without game-specific code', async () => {
  const definition = botGame({
    kind: 'scored',
    actionScores: { wait: -1, advance: 10 },
    ties: 'random',
  });
  const game = await testGame(definition)
    .players([{ username: 'Bot', isBot: true }, 'Lila'])
    .seed(123)
    .start();
  const runtime = new DeclarativeGameRuntime(definition);

  expect(runtime.getBotActions(game.state(), -1)).toEqual([
    expect.objectContaining({ type: 'advance', payload: {} }),
  ]);
  expect(runtime.getBotActions(game.state(), -1)).toEqual(
    runtime.getBotActions(game.state(), -1),
  );
});

it('rejects a scored action reference that is absent from the JSON game', () => {
  expect(() =>
    botGame({ kind: 'scored', actionScores: { missing: 10 } }),
  ).toThrow(/bot\.actionScores\.missing.*unknown action missing/);
});
