import { createHash } from 'node:crypto';
import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/aventure-sauvage/manifest.json';
import document from '../../../games/les-quatre-vents/aventure-sauvage/game.json';
import cards from '../../../games/les-quatre-vents/aventure-sauvage/content/cards.json';
import board from '../../../games/les-quatre-vents/aventure-sauvage/content/board.json';
import pawns from '../../../games/les-quatre-vents/aventure-sauvage/content/pawns.json';

const reference = [
  {
    seed: 1,
    commands: 43,
    status: 'finished',
    events: 284,
    sha256: '79aa3880143e09bfb57c8aa44239452c17f2fb2f731ba73a1127e0cf337d19a6',
  },
  {
    seed: 7,
    commands: 43,
    status: 'finished',
    events: 290,
    sha256: '11b6fa5f3806cd85d1b114ca253e1908d5f48110b718324c543a7c01b4020486',
  },
  {
    seed: 42,
    commands: 29,
    status: 'finished',
    events: 190,
    sha256: 'c4ddb9c515363f886329b7251f1e63043dc45421ce11cdc7a875bb41831a16c1',
  },
] as const;

it.each(reference)(
  'preserves the certified event-race trace for seed $seed',
  async ({ seed, commands, status, events, sha256 }) => {
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
      { maxCommands: 200, startAtMs: 1000 },
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
