import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { DirectionalHazardRaceProgram } from '../effect-packs/race-directional-hazards/program';
import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

const text = { type: 'string', minLength: 1, maxLength: 10000 } as const;
const integer = { type: 'integer', minimum: -10000, maximum: 10000 } as const;

export const jsonDirectionalHazardRaceSchema = object({
  trackId: id,
  diceId: id,
  deckId: id,
  nextDeltaChoiceId: id,
  maxDepth: positive,
  finishReason: id,
  resources: object({ lastRoll: id, lastMove: id, idleTurns: id }),
  counterId: id,
  mirrorStatusId: id,
  tiles: array(
    object({ label: text, description: text, isNeutral: boolean }),
    2,
  ),
  cards: array(
    object(
      {
        id: positive,
        title: text,
        text,
        kind: {
          enum: [
            'move',
            'skip',
            'special',
            'global',
            'conditional',
            'rule',
            'neutral',
          ],
        },
        moveDelta: integer,
        effects: array(ref('effect')),
      },
      ['id', 'title', 'text', 'kind', 'effects'],
    ),
    1,
  ),
});

export function assertDirectionalHazardRaceReferences(
  program: DirectionalHazardRaceProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  counters: ReadonlySet<string>,
) {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`DirectionalHazard race: ${reason}`);
  };
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('one tile per track position required');
  if (
    !components.some(
      (item) => item.component === 'dice.set' && item.id === program.diceId,
    )
  )
    fail('unknown dice');
  if (
    !components.some(
      (item) => item.component === 'cards.deck' && item.id === program.deckId,
    )
  )
    fail('unknown deck');
  for (const resource of Object.values(program.resources))
    if (!resources.has(resource)) fail(`unknown resource ${resource}`);
  if (!counters.has(program.counterId)) fail('unknown counter');
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('duplicate card id');
}
