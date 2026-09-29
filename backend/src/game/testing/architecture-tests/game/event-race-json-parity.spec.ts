import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/aventure-sauvage/manifest.json';
import documentSource from '../../../games/les-quatre-vents/aventure-sauvage/game.json';
import cards from '../../../games/les-quatre-vents/aventure-sauvage/content/cards.json';
import board from '../../../games/les-quatre-vents/aventure-sauvage/content/board.json';
import pawns from '../../../games/les-quatre-vents/aventure-sauvage/content/pawns.json';

const assets = {
  'content/cards.json': cards,
  'content/board.json': board,
  'content/pawns.json': pawns,
};
const current = structuredClone(documentSource);
const [race, eventRace] = current.patterns;
const {
  kind: _kind,
  rollRecipe: _rollRecipe,
  drawRecipe: _drawRecipe,
  pendingDrawFlag: _pendingDrawFlag,
  ...legacyEventRace
} = eventRace;
const { bot: _bot, patterns: _patterns, ...withoutPatterns } = current;
const legacy = {
  ...withoutPatterns,
  contentVersion: '1',
  patterns: [race],
  victory: { kind: 'by-event-race' },
  eventRace: legacyEventRace,
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

it.each([1, 7, 42])(
  'preserves state and events from the certified event race for seed %i',
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
