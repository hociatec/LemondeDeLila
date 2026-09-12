import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from '../../../games/les-quatre-vents/aventure-sauvage/manifest.json';
import document from '../../../games/les-quatre-vents/aventure-sauvage/game.json';
import cards from '../../../games/les-quatre-vents/aventure-sauvage/content/cards.json';
import board from '../../../games/les-quatre-vents/aventure-sauvage/content/board.json';
import pawns from '../../../games/les-quatre-vents/aventure-sauvage/content/pawns.json';
import reference from '../../fixtures/aventure-sauvage-before-json-parity.json';

it.each(reference)(
  'preserves the complete event-card race for seed $seed',
  async ({ seed, commands, events, sha256, status }) => {
    const definition = compileJsonGame(manifest, document, {
      'content/cards.json': cards,
      'content/board.json': board,
      'content/pawns.json': pawns,
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
