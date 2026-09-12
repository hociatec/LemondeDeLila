import { createHash } from 'node:crypto';
import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import ritesManifest from '../../../games/vents-dansants/entre-rites-et-lumieres/manifest.json';
import ritesDocument from '../../../games/vents-dansants/entre-rites-et-lumieres/game.json';
import ritesCatalogue from '../../../games/vents-dansants/entre-rites-et-lumieres/content/catalogue.json';
import professionsManifest from '../../../games/vents-dansants/les-mains-de-la-terre/manifest.json';
import professionsDocument from '../../../games/vents-dansants/les-mains-de-la-terre/game.json';
import professionsCatalogue from '../../../games/vents-dansants/les-mains-de-la-terre/catalogue.json';
import reference from '../../fixtures/filtered-deal-before-parity.json';

const rites = compileJsonGame(ritesManifest, ritesDocument, {
  'content/catalogue.json': ritesCatalogue,
});
const professions = compileJsonGame(professionsManifest, professionsDocument, {
  'content/catalogue.json': professionsCatalogue,
});

it.each(reference)(
  'preserves initial dealing for $game at seed $seed',
  async (scenario) => {
    const definition =
      scenario.game === 'entre-rites-et-lumieres' ? rites : professions;
    const game = await testGame(definition)
      .players(['One', 'Two', 'Three'])
      .seed(scenario.seed)
      .start();
    const trace = (await game.events())
      .filter((event) => event.type !== 'engine.state.committed')
      .map(({ type, data, visibility }) => ({ type, data, visibility }));
    expect(trace).toHaveLength(scenario.events);
    expect(
      createHash('sha256').update(JSON.stringify(trace)).digest('hex'),
    ).toBe(scenario.sha256);
    const expected = game.state();
    // Replay drains the transport event buffer; compare all persisted game data.
    if (
      'engine' in expected &&
      expected.engine !== null &&
      typeof expected.engine === 'object'
    ) {
      Reflect.deleteProperty(expected.engine, 'pendingEvents');
    }
    expect(await game.replay()).toEqual(expected);
  },
);
