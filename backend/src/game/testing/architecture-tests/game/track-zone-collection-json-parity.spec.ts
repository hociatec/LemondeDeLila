import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/mon-village-mon-histoire/manifest.json';
import document from '../../../games/les-quatre-vents/mon-village-mon-histoire/game.json';
import catalogue from '../../../games/les-quatre-vents/mon-village-mon-histoire/content/catalogue.json';

const reference = [
  {
    seed: 17,
    count: 2,
    commands: 24,
    events: 307,
    sha256: 'a5bec9b070bd9bfd560c138e0797aae76a0cc588dc444d46ea4df42e16413748',
  },
  {
    seed: 42,
    count: 6,
    commands: 62,
    events: 802,
    sha256: '5b32b5bb25735855b5ba47388f55b4e635a2e311bfb30761ed1932a62f30ddb8',
  },
] as const;

it.each(reference)(
  'preserves the complete track-zone collection for seed $seed with $count players',
  async ({ seed, count, commands, events, sha256 }) => {
    const definition = compileJsonGame(manifest, document, {
      'content/catalogue.json': catalogue,
    });
    const players = Array.from(
      { length: count },
      (_, index) => `Player ${index + 1}`,
    );
    const game = await testGame(definition).players(players).seed(seed).start();
    const result = new GameSimulator().run(
      new DeclarativeGameRuntime(definition),
      game.state(),
      { maxCommands: 300, startAtMs: 1000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe('finished');
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
