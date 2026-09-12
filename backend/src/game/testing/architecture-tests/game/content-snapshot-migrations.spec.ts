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
import { resolveJsonContent } from '../../../engine/json/public-api';
import composition from '../../../games/les-quatre-vents/panier-express/game.json';
import board from '../../../games/les-quatre-vents/panier-express/content/board.json';
import cards from '../../../games/les-quatre-vents/panier-express/content/cards.json';
import pawns from '../../../games/les-quatre-vents/panier-express/content/pawns.json';
import products from '../../../games/les-quatre-vents/panier-express/content/products.json';
import quizzes from '../../../games/les-quatre-vents/panier-express/content/quizzes.json';
import olympiaManifest from '../../../games/vents-dansants/olympia/manifest.json';
import olympiaDocument from '../../../games/vents-dansants/olympia/game.json';
import olympiaCatalogue from '../../../games/vents-dansants/olympia/catalogue.json';
import aventureManifest from '../../../games/les-quatre-vents/aventure-sauvage/manifest.json';
import aventureDocument from '../../../games/les-quatre-vents/aventure-sauvage/game.json';
import aventureBoard from '../../../games/les-quatre-vents/aventure-sauvage/content/board.json';
import aventureCards from '../../../games/les-quatre-vents/aventure-sauvage/content/cards.json';
import aventurePawns from '../../../games/les-quatre-vents/aventure-sauvage/content/pawns.json';
import missionManifest from '../../../games/les-quatre-vents/mission-galaxie/manifest.json';
import missionDocument from '../../../games/les-quatre-vents/mission-galaxie/game.json';
import missionCatalogue from '../../../games/les-quatre-vents/mission-galaxie/catalogue.json';
import piratesManifest from '../../../games/les-quatre-vents/pirates-en-vadrouille/manifest.json';
import piratesDocument from '../../../games/les-quatre-vents/pirates-en-vadrouille/game.json';
import piratesCatalogue from '../../../games/les-quatre-vents/pirates-en-vadrouille/content/catalogue.json';
import mamanManifest from '../../../games/les-quatre-vents/tout-pres-de-maman/manifest.json';
import mamanDocument from '../../../games/les-quatre-vents/tout-pres-de-maman/game.json';
import mamanCatalogue from '../../../games/les-quatre-vents/tout-pres-de-maman/content/catalogue.json';
import sacManifest from '../../../games/les-quatre-vents/sac-a-malices/manifest.json';
import sacDocument from '../../../games/les-quatre-vents/sac-a-malices/game.json';
import sacCatalogue from '../../../games/les-quatre-vents/sac-a-malices/catalogue.json';
import natureManifest from '../../../games/vents-dansants/dame-nature/manifest.json';
import natureDocument from '../../../games/vents-dansants/dame-nature/game.json';
import natureCatalogue from '../../../games/vents-dansants/dame-nature/content/catalogue.json';

const panierDocument = resolveJsonContent(composition, {
  'content/board.json': board,
  'content/cards.json': cards,
  'content/pawns.json': pawns,
  'content/products.json': products,
  'content/quizzes.json': quizzes,
});
const mission = compileJsonGame(missionManifest, missionDocument, {
  'content/catalogue.json': missionCatalogue,
});
const pirates = compileJsonGame(piratesManifest, piratesDocument, {
  'content/catalogue.json': piratesCatalogue,
});
const maman = compileJsonGame(mamanManifest, mamanDocument, {
  'content/catalogue.json': mamanCatalogue,
});
const nature = compileJsonGame(natureManifest, natureDocument, {
  'content/catalogue.json': natureCatalogue,
});
const olympia = compileJsonGame(olympiaManifest, olympiaDocument, {
  'content/catalogue.json': olympiaCatalogue,
});
const sac = compileJsonGame(sacManifest, sacDocument, {
  'content/catalogue.json': sacCatalogue,
});

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

it('refuses former Aventure rules after the complete JSON migration', async () => {
  const aventure = compileJsonGame(aventureManifest, aventureDocument, {
    'content/board.json': aventureBoard,
    'content/cards.json': aventureCards,
    'content/pawns.json': aventurePawns,
  });
  const game = await testGame(aventure).players(2).seed(42).start();
  const source = game.state() as DeclarativeState<Record<string, never>>;
  source.engine.rulesVersion = '2';
  const before = structuredClone(source);
  expect(() =>
    new DeclarativeGameRuntime(aventure).applyActions(source, []),
  ).toThrow();
  expect(source).toEqual(before);
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

it('preserves saved Sac gameplay after JSON normalization', async () => {
  await verifyMigration(sac, 'sac-a-malices@content:2959fe7b@format:2');
});

it('preserves Dame Nature snapshots when quiz metadata uses answer indices', async () => {
  await verifyMigration(nature, 'dame-nature@content:593ce53d');
});
