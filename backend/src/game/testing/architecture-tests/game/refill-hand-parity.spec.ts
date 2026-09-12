import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import cerclesManifest from '../../../games/vents-dansants/cercles-sacres/manifest.json';
import cerclesDocument from '../../../games/vents-dansants/cercles-sacres/game.json';
import cerclesCatalogue from '../../../games/vents-dansants/cercles-sacres/content/catalogue.json';
import gerardManifest from '../../../games/vents-dansants/gerard-president/manifest.json';
import gerardDocument from '../../../games/vents-dansants/gerard-president/game.json';
import gerardCatalogue from '../../../games/vents-dansants/gerard-president/content/catalogue.json';
import reference from '../../fixtures/refill-hand-before-parity.json';

const cercles = compileJsonGame(cerclesManifest, cerclesDocument, {
  'content/catalogue.json': cerclesCatalogue,
});
const gerard = compileJsonGame(gerardManifest, gerardDocument, {
  'content/catalogue.json': gerardCatalogue,
});

it.each(reference)(
  'preserves refill traces for $game at seed $seed',
  async (scenario) => {
    const definition = scenario.game === 'cercles-sacres' ? cercles : gerard;
    const game = await testGame(definition)
      .players(['A', 'B', 'C'].map((username) => ({ username, isBot: true })))
      .seed(scenario.seed)
      .start();
    const run = new GameSimulator().run(
      new DeclarativeGameRuntime(definition),
      game.state(),
      { maxCommands: 300 },
    );
    expect(run.error).toBeUndefined();
    expect(run.events).toHaveLength(scenario.events);
    expect(
      createHash('sha256').update(JSON.stringify(run.events)).digest('hex'),
    ).toBe(scenario.sha256);
  },
);
