import { createHash } from 'node:crypto';
import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from '../../../games/vents-dansants/gerard-president/manifest.json';
import document from '../../../games/vents-dansants/gerard-president/game.json';
import catalogue from '../../../games/vents-dansants/gerard-president/content/catalogue.json';
import reference from '../../fixtures/gerard-specials-before-json-parity.json';

const definition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

it.each(reference)(
  'preserves the special-card scenario $card',
  async (scenario) => {
    const game = await testGame(definition)
      .players(['One', 'Two', 'Three'])
      .seed(scenario.seed)
      .start();
    await game.as(1).do('set_theme', {});
    await game.as(scenario.actorId).do('play_special', scenario.action.payload);
    const trace = (await game.events())
      .filter((event) => event.type !== 'engine.state.committed')
      .map(({ type, data, visibility }) => ({ type, data, visibility }));
    expect(trace).toHaveLength(scenario.events);
    expect(
      createHash('sha256').update(JSON.stringify(trace)).digest('hex'),
    ).toBe(scenario.sha256);
    expect(await game.replay()).toEqual(game.state());
  },
);
