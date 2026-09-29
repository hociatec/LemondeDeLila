import {
  testGame,
  GameSimulator,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/la-parade-sucree/manifest.json';
import documentSource from '../../../games/vents-dansants/la-parade-sucree/game.json';
import catalogue from '../../../games/vents-dansants/la-parade-sucree/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const current = structuredClone(documentSource);
const [pattern] = current.patterns;
const {
  kind: _kind,
  playRecipe: _playRecipe,
  passRecipe: _passRecipe,
  ...legacyParade
} = pattern;
const { bot: _bot, patterns: _patterns, ...withoutPattern } = current;
const legacy = {
  ...withoutPattern,
  contentVersion: '1',
  victory: { kind: 'by-parade' },
  parade: legacyParade,
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

it.each([11, 23, 67])(
  'preserves state and events from the certified parade pack for seed %i',
  async (seed) => {
    const before = compileJsonGame(manifest, legacy, assets);
    const after = compileJsonGame(manifest, current, assets);
    const players = ['One', 'Two'];
    const beforeGame = await testGame(before)
      .players(players)
      .seed(seed)
      .start();
    const afterGame = await testGame(after).players(players).seed(seed).start();
    const runner = new GameSimulator();
    const baseline = runner.run(
      new DeclarativeGameRuntime(before),
      beforeGame.state(),
      { maxCommands: 100, startAtMs: 1000 },
    );
    const migrated = runner.run(
      new DeclarativeGameRuntime(after),
      afterGame.state(),
      { maxCommands: 100, startAtMs: 1000 },
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
