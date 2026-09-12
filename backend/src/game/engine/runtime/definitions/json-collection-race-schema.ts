import type { CollectionRaceProgram } from '../contracts/collection-race-program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

const positive = { type: 'integer', minimum: 1, maximum: 10000 } as const;
export const jsonCollectionRaceSchema = object({
  trackId: id,
  diceId: id,
  finishReason: id,
  eventNamespace: id,
  collectedEvent: id,
  tiles: array(
    object({
      n: positive,
      title: { type: 'string', minLength: 1, maxLength: 2000 },
      description: { type: 'string', maxLength: 10000 },
      type: { enum: ['card', 'finish'] },
    }),
    2,
  ),
  zones: array(
    object({
      id: positive,
      minimumTile: positive,
      maximumTile: positive,
      deckId: id,
      resourceId: id,
    }),
    1,
  ),
});

export function assertCollectionRaceReferences(
  program: CollectionRaceProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Collection race: ${reason}`);
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
  if (
    !components.some(
      (component) =>
        component.component === 'dice.set' && component.id === program.diceId,
    )
  )
    fail('unknown dice');
  if (program.tiles.at(-1)?.type !== 'finish')
    fail('last tile must finish the race');
  const zoneIds = new Set<number>();
  for (const zone of program.zones) {
    if (zoneIds.has(zone.id)) fail('duplicate zone');
    zoneIds.add(zone.id);
    if (zone.minimumTile > zone.maximumTile) fail('inverted zone range');
    if (!resources.has(zone.resourceId)) fail('unknown zone resource');
    const deck = components.find(
      (component) =>
        component.component === 'cards.deck' && component.id === zone.deckId,
    );
    if (deck?.component !== 'cards.deck') {
      fail('unknown zone deck');
      continue;
    }
    if (
      deck.cards.some(
        (card) =>
          card === null ||
          typeof card !== 'object' ||
          !('id' in card) ||
          !('attributes' in card) ||
          card.attributes === null ||
          typeof card.attributes !== 'object' ||
          Reflect.get(card.attributes, 'zoneId') !== zone.id,
      )
    )
      fail('zone cards require matching zoneId attributes');
  }
}
