import {
  testGame,
  DeclarativeGameRuntime,
} from '../../../engine/testing/public-api';
import type {
  DeclarativeState,
  CompiledGameDefinition,
  GameActionMap,
} from '../../../engine/runtime/definitions/game-definition';
import { compileJsonGame } from '../../../engine/json/public-api';
import panierManifest from '../../../games/les-quatre-vents/panier-express/manifest.json';
import panierDocument from '../../../games/les-quatre-vents/panier-express/game.json';
import olympia from '../../../games/vents-dansants/olympia/game';
import aventure from '../../../games/les-quatre-vents/aventure-sauvage/game';
import mission from '../../../games/les-quatre-vents/mission-galaxie/game';
import pirates from '../../../games/les-quatre-vents/pirates-en-vadrouille/game';
import maman from '../../../games/les-quatre-vents/tout-pres-de-maman/game';
import sac from '../../../games/les-quatre-vents/sac-a-malices/game';
import type { SacState } from '../../../games/les-quatre-vents/sac-a-malices/state';
import nature from '../../../games/vents-dansants/dame-nature/game';

async function verifyMigration<
  TState extends object,
  TActions extends GameActionMap<TState>,
>(
  definition: CompiledGameDefinition<TState, TActions>,
  previousVersion: string,
) {
  const game = testGame(definition).players(2).seed(42);
  await game.start();
  const source = game.state() as DeclarativeState<Record<string, never>>;
  source.engine.contentVersion = previousVersion;
  const before = structuredClone(source);
  const runtime = new DeclarativeGameRuntime(definition);
  const restored = runtime.applyActions(source, []);
  expect(restored).toEqual({
    ...before,
    engine: { ...before.engine, contentVersion: definition.contentVersion },
  });
  expect(source).toEqual(before);
  source.engine.contentVersion = `${previousVersion}-unknown`;
  expect(() => runtime.applyActions(source, [])).toThrow();
}

it('rejects historical Panier continuations after migration to the JSON board rules', async () => {
  const panier = compileJsonGame(panierManifest, panierDocument);
  const game = await testGame(panier).players(2).seed(42).start();
  const source = game.state() as DeclarativeState<Record<string, never>>;
  source.engine.rulesVersion = '1';
  const before = structuredClone(source);
  expect(() =>
    new DeclarativeGameRuntime(panier).applyActions(source, []),
  ).toThrow();
  expect(source).toEqual(before);
});

it('preserves saved Olympia gameplay when expanding its catalogue', async () => {
  await verifyMigration(olympia, 'olympia@content:25cb5135');
});

it('preserves saved Aventure gameplay after JSON normalization', async () => {
  await verifyMigration(aventure, 'aventure-sauvage@content:c48df7e1');
});
it('preserves saved Mission gameplay after JSON normalization', async () => {
  await verifyMigration(mission, 'mission-galaxie@content:6a876766');
});
it('preserves saved Pirates gameplay after JSON normalization', async () => {
  await verifyMigration(pirates, 'pirates-en-vadrouille@content:ddf4bb7f');
});
it('preserves saved Maman gameplay after JSON normalization', async () => {
  await verifyMigration(maman, 'tout-pres-de-maman@content:f766ed9f');
});

it('rejects old Sac rules without mutating the snapshot', async () => {
  const game = testGame(sac).players(2).seed(131);
  await game.start();
  const source = game.state() as DeclarativeState<SacState>;
  source.engine.rulesVersion = '1';
  const before = structuredClone(source);
  const runtime = new DeclarativeGameRuntime(sac);
  expect(() => runtime.applyActions(source, [])).toThrow();
  expect(source).toEqual(before);
});

it('preserves Dame Nature snapshots when quiz metadata uses answer indices', async () => {
  await verifyMigration(nature, 'dame-nature@content:593ce53d');
});
