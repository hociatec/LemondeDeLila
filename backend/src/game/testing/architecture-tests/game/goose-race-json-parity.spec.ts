import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-sacres/jeu-oie/manifest.json';
import document from '../../../games/vents-sacres/jeu-oie/game.json';
import catalogue from '../../../games/vents-sacres/jeu-oie/content/catalogue.json';

const reference = [
  {
    seed: 1,
    count: 2,
    commands: 75,
    status: 'finished',
    events: 607,
    sha256: '746262d224f740419b3cbc2be581478d1bb1e67cf6c3f42f577a6da0525f344c',
  },
  {
    seed: 7,
    count: 2,
    commands: 36,
    status: 'finished',
    events: 297,
    sha256: '1f98487555a9aa8032cf875e2983449cf61c295f9b9b5c52f73a725291a63934',
  },
  {
    seed: 42,
    count: 6,
    commands: 71,
    status: 'finished',
    events: 665,
    sha256: 'd8bebc7ae57ddd2a05c60bccd67b0d5c71fae556df14af041f3ec2cc74d7ee8e',
  },
] as const;

it.each(reference)(
  'preserves the certified goose race for seed $seed with $count players',
  async ({ seed, count, commands, status, events, sha256 }) => {
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
