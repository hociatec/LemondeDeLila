import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/taxi-express/manifest.json';
import documentSource from '../../../games/les-quatre-vents/taxi-express/game.json';
import board from '../../../games/les-quatre-vents/taxi-express/content/board.json';
import clients from '../../../games/les-quatre-vents/taxi-express/content/clients.json';
import events from '../../../games/les-quatre-vents/taxi-express/content/events.json';

const assets = {
  'content/board.json': board,
  'content/clients.json': clients,
  'content/events.json': events,
};
const current = structuredClone(documentSource);
const { delivery, ...legacyRacePattern } = current.patterns[0];
const { recipe: _recipe, ...legacyDelivery } = delivery;
const { bot: _bot, ...withoutBot } = current;
const legacy = {
  ...withoutBot,
  contentVersion: '2',
  patterns: [legacyRacePattern],
  victory: { kind: 'by-delivery-race' },
  deliveryRace: {
    ...legacyDelivery,
    trackId: current.patterns[0].trackId,
    diceId: 'main',
    tiles: board.tiles,
  },
};

function behavioralState(state: object) {
  const value = structuredClone(state) as {
    metadata?: { restoreId?: string };
    engine?: { contentDigest?: string; contentVersion?: string };
  };
  if (value.metadata) delete value.metadata.restoreId;
  if (value.engine) {
    delete value.engine.contentDigest;
    delete value.engine.contentVersion;
  }
  return value;
}

it.each([3, 42, 53])(
  'preserves state and events from the certified delivery pack for seed %i',
  async (seed) => {
    const before = compileJsonGame(manifest, legacy, assets);
    const after = compileJsonGame(manifest, current, assets);
    const players = ['One', 'Two', 'Three'];
    const beforeGame = await testGame(before)
      .players(players)
      .seed(seed)
      .start();
    const afterGame = await testGame(after).players(players).seed(seed).start();
    const runner = new GameSimulator();
    const baseline = runner.run(
      new DeclarativeGameRuntime(before),
      beforeGame.state(),
      { maxCommands: 200, startAtMs: 1000 },
    );
    const migrated = runner.run(
      new DeclarativeGameRuntime(after),
      afterGame.state(),
      { maxCommands: 200, startAtMs: 1000 },
    );
    expect(migrated.error).toBeUndefined();
    expect(migrated.status).toBe(baseline.status);
    expect(migrated.commands).toBe(baseline.commands);
    expect(migrated.winnerPlayerIds).toEqual(baseline.winnerPlayerIds);
    expect(behavioralState(migrated.finalState)).toEqual(
      behavioralState(baseline.finalState),
    );
    expect(migrated.events).toEqual(baseline.events);
  },
);
