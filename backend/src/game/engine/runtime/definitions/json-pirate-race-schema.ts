import type { PirateRaceProgram } from '../extensions/pirate-race/program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

const deckKinds = object({ treasure: id, obstacle: id, bonus: id });

export const jsonPirateRaceSchema = object({
  trackId: id,
  diceId: id,
  tiles: array(
    object({
      n: { type: 'integer', minimum: 0, maximum: 10000 },
      title: { type: 'string', minLength: 1, maxLength: 2000 },
      description: { type: 'string', maxLength: 10000 },
      type: {
        enum: [
          'start',
          'neutral',
          'bonus',
          'treasure',
          'obstacle',
          'gold',
          'finish',
        ],
      },
    }),
    2,
  ),
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

export function assertPirateRaceReferences(
  program: PirateRaceProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError('Pirate race: ' + reason);
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
  if (!resources.has(program.goldResource)) fail('unknown gold resource');
  if (program.requiredTreasures > program.collectionLimit)
    fail('required treasures exceed collection limit');
}
