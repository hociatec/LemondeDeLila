import type { TreasureTrackRaceProgram } from '../effect-packs/race-treasure-track/program';
import type { GameComponentDefinition } from '../../engine/runtime/definitions/component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRecord as record,
} from '../../engine/runtime/contracts/json-author-schema';
import { GameConfigurationError } from '../../core/domain/errors/game-domain.errors';

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
  const fail = (reason: string): never => {
    throw new GameConfigurationError('TreasureTrack race: ' + reason);
  };
  const track = components.find(
    (component) =>
      component.component === 'movement.track' &&
      component.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('one tile per track position required');
  const dice = components.find(
    (component) =>
      component.component === 'dice.set' && component.id === program.diceId,
  );
  if (dice?.component !== 'dice.set') fail('unknown dice');
  for (const deckId of Object.values(program.decks)) {
    const deck = components.find(
      (component) =>
        component.component === 'cards.deck' && component.id === deckId,
    );
    if (deck?.component !== 'cards.deck') fail(`unknown deck ${deckId}`);
  }
  for (const inventoryId of Object.values(program.inventories)) {
    const inventory = components.find(
      (component) =>
        component.component === 'inventory.set' && component.id === inventoryId,
    );
    if (inventory?.component !== 'inventory.set')
      fail(`unknown inventory ${inventoryId}`);
  }
  for (const tile of program.tiles)
    if (!program.tileRules[tile.type]) fail('unknown tile rule');
  for (const rule of Object.values(program.tileRules))
    if (rule.kind === 'draw' && (!rule.deck || !program.decks[rule.deck]))
      fail('unknown draw deck');
  for (const key of Object.keys(program.decks))
    if (!program.inventories[key] || !program.deckRules[key])
      fail('missing deck inventory or rule');
  if (!program.inventories[program.victoryCollection])
    fail('unknown victory collection');
  if (!resources.has(program.goldResource)) fail('unknown gold resource');
  if (program.requiredTreasures > program.collectionLimit)
    fail('required treasures exceed collection limit');
}
