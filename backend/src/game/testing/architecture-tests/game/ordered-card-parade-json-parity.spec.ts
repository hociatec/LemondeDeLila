import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/la-parade-sucree/manifest.json';
import document from '../../../games/vents-dansants/la-parade-sucree/game.json';
import catalogue from '../../../games/vents-dansants/la-parade-sucree/content/catalogue.json';

const reference = [
  {
    seed: 11,
    commands: 19,
    status: 'finished',
    events: 91,
    sha256: 'ad104fdc17a451951d5115667b1ad620ff7b70e5d90a04cc0491311d821c3330',
  },
  {
    seed: 23,
    commands: 19,
    status: 'finished',
    events: 91,
    sha256: '9231cc8e82471732558a5f2785de4bb5a9955035583f132f889d3d7ae90b0797',
  },
  {
    seed: 67,
    commands: 21,
    status: 'finished',
    events: 97,
    sha256: '6621f80c685efc19041e980deb1d61d537062783e11a9f70b12291ea4dd04c80',
  },
] as const;

it.each(reference)(
  'preserves the certified parade trace for seed $seed',
  async ({ seed, commands, status, events, sha256 }) => {
    const definition = compileJsonGame(manifest, document, {
      'content/catalogue.json': catalogue,
    });
    const game = await testGame(definition)
      .players(['One', 'Two'])
      .seed(seed)
      .start();
    const result = new GameSimulator().run(
      new DeclarativeGameRuntime(definition),
      game.state(),
      { maxCommands: 100, startAtMs: 1000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(status);
    expect(result.commands).toBe(commands);
    const trace = result.events
      .filter((event) => event.type !== 'engine.state.committed')
      .map(({ type, data, visibility }) => ({ type, data, visibility }));
    expect(trace).toHaveLength(events);
    expect(
      createHash('sha256').update(JSON.stringify(trace)).digest('hex'),
    ).toBe(sha256);
  },
);
