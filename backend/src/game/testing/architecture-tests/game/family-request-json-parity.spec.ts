import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/dame-nature/manifest.json';
import document from '../../../games/vents-dansants/dame-nature/game.json';
import catalogue from '../../../games/vents-dansants/dame-nature/content/catalogue.json';

const reference = [
  {
    seed: 31,
    count: 2,
    commands: 217,
    events: 830,
    sha256: '6474be24f740e3ee0fb483546c7d5a0cc91db380f561f20ec43bfa25b6a1389b',
  },
  {
    seed: 42,
    count: 6,
    commands: 49,
    events: 333,
    sha256: '0a0735eac5e5a26d2e6d5a2f6d3897f783f25d8c9942073249f1b0d9c6e01db8',
  },
] as const;

it.each(reference)(
  'preserves the complete family-request game for seed $seed with $count players',
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
