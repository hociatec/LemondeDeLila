import {
  authoringFailure,
  authoringProperty,
} from '../../../engine/sdk/extension-api';
import type { TreasureTrackRaceProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRecord as record,
} from '../../../engine/sdk/extension-api';

const deckKinds = record(id);

export const jsonTreasureTrackRaceSchema = object({
  trackId: id,
  diceId: id,
  tiles: array(
    object({
      n: { type: 'integer', minimum: 0, maximum: 10000 },
      title: { type: 'string', minLength: 1, maxLength: 2000 },
      description: { type: 'string', maxLength: 10000 },
      type: id,
    }),
    2,
  ),
  tileRules: record({
    oneOf: [
      object({ kind: { enum: ['none', 'finish'] } }),
      object({ kind: { const: 'draw' }, deck: id }),
      object({ kind: { const: 'gain' }, amount: positive }),
    ],
  }),
  deckRules: record(
    object({
      resolveEffects: { type: 'boolean' },
      protected: { type: 'boolean' },
    }),
  ),
  victoryCollection: id,
  decks: deckKinds,
  inventories: deckKinds,
  goldResource: id,
  obstacleImmunityStatus: id,
  collectionLimit: positive,
  requiredTreasures: positive,
  requiredGold: positive,
  retreatSpaces: positive,
  finishReason: id,
  stealEffectId: id,
  eventNamespace: id,
});

export function assertTreasureTrackRaceReferences(
  program: TreasureTrackRaceProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
): void {
  const fail = authoringFailure(
    'game.json.treasureTrackRace',
    program,
    'TreasureTrack race: ',
  );
  const track = components.find(
    (component) =>
      component.component === 'movement.track' &&
      component.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('trackId', 'one tile per track position required');
  const dice = components.find(
    (component) =>
      component.component === 'dice.set' && component.id === program.diceId,
  );
  if (dice?.component !== 'dice.set') fail('diceId', 'unknown dice');
  for (const [key, deckId] of Object.entries(program.decks)) {
    const deck = components.find(
      (component) =>
        component.component === 'cards.deck' && component.id === deckId,
    );
    if (deck?.component !== 'cards.deck')
      fail(authoringProperty('decks', key), `unknown deck ${deckId}`);
  }
  for (const [key, inventoryId] of Object.entries(program.inventories)) {
    const inventory = components.find(
      (component) =>
        component.component === 'inventory.set' && component.id === inventoryId,
    );
    if (inventory?.component !== 'inventory.set')
      fail(
        authoringProperty('inventories', key),
        `unknown inventory ${inventoryId}`,
      );
  }
  for (const [i, tile] of program.tiles.entries())
    if (!program.tileRules[tile.type])
      fail(`tiles[${i}].type`, 'unknown tile rule');
  for (const [key, rule] of Object.entries(program.tileRules))
    if (rule.kind === 'draw' && (!rule.deck || !program.decks[rule.deck]))
      fail(`${authoringProperty('tileRules', key)}.deck`, 'unknown draw deck');
  for (const key of Object.keys(program.decks))
    if (!program.inventories[key] || !program.deckRules[key])
      fail(
        authoringProperty(
          !program.inventories[key] ? 'inventories' : 'deckRules',
          key,
        ),
        'missing deck inventory or rule',
      );
  if (!program.inventories[program.victoryCollection])
    fail('victoryCollection', 'unknown victory collection');
  if (!resources.has(program.goldResource))
    fail('goldResource', 'unknown gold resource');
  if (program.requiredTreasures > program.collectionLimit)
    fail('requiredTreasures', 'required treasures exceed collection limit');
}
