import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from '../../../games/vents-dansants/les-absurdissimes/manifest.json';
import document from '../../../games/vents-dansants/les-absurdissimes/game.json';
import cards from '../../../games/vents-dansants/les-absurdissimes/content/cards.json';
import reference from '../../fixtures/les-absurdissimes-before-json-parity.json';

it.each(reference)(
  'preserves the complete judged-card game for seed $seed',
  async ({ seed, commands, events, sha256, status }) => {
    const definition = compileJsonGame(manifest, document, {
      'content/cards.json': cards,
    });
    const game = await testGame(definition)
      .players(['One', 'Two', 'Three'])
      .seed(seed)
      .start();
    const result = new GameSimulator().run(
      new DeclarativeGameRuntime(definition),
      game.state(),
      { maxCommands: commands, startAtMs: 1000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(status);
    const trace = result.events
      .filter((e) => e.type !== 'engine.state.committed')
      .map(({ type, data, visibility }) => ({ type, data, visibility }));
    expect(trace).toHaveLength(events);
    expect(
      createHash('sha256').update(JSON.stringify(trace)).digest('hex'),
    ).toBe(sha256);
  },
);
