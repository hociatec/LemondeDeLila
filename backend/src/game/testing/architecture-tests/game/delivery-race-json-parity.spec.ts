import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/taxi-express/manifest.json';
import document from '../../../games/les-quatre-vents/taxi-express/game.json';
import board from '../../../games/les-quatre-vents/taxi-express/content/board.json';
import clients from '../../../games/les-quatre-vents/taxi-express/content/clients.json';
import gameEvents from '../../../games/les-quatre-vents/taxi-express/content/events.json';

const reference = [
  {
    seed: 3,
    commands: 200,
    status: 'step-limit',
    events: 1838,
    sha256: '3a6cb08c9768e0e14d2ea02105c38e53530ec77bed1192fe9eb12af7bf26034e',
  },
  {
    seed: 42,
    commands: 200,
    status: 'step-limit',
    events: 1836,
    sha256: '8fc4f5f35c11123dbeddd018cc761ec1609f8e9997129f87a5df94580541f9ec',
  },
  {
    seed: 53,
    commands: 200,
    status: 'step-limit',
    events: 1837,
    sha256: '8ba2c85706d87daac1b5f4afd89457f64d6e50b6eb5453a4b507a822788f0070',
  },
] as const;

it.each(reference)(
  'preserves the certified delivery trace for seed $seed',
  async ({ seed, commands, status, events, sha256 }) => {
    const definition = compileJsonGame(manifest, document, {
      'content/board.json': board,
      'content/clients.json': clients,
      'content/events.json': gameEvents,
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
      .filter((event) => event.type !== 'engine.state.committed')
      .map(({ type, data, visibility }) => ({ type, data, visibility }));
    expect(trace).toHaveLength(events);
    expect(
      createHash('sha256').update(JSON.stringify(trace)).digest('hex'),
    ).toBe(sha256);
  },
);
