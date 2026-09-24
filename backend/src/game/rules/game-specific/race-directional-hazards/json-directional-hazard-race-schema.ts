import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { DirectionalHazardRaceProgram } from './program';
import { directionalHazardCardKinds } from './directional-hazard-effect-types';
import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../../../engine/sdk/extension-api';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';

const text = { type: 'string', minLength: 1, maxLength: 10000 } as const;
const integer = { type: 'integer', minimum: -10000, maximum: 10000 } as const;

const requiredSchema = object({
  parameters: object({
    checkpointSpan: positive,
    shieldAdvance: integer,
    replayAdvance: integer,
    swapAdvance: integer,
    leaderRetreat: integer,
    othersAdvance: integer,
    lastAdvance: integer,
    retreatRecovery: integer,
    checkpointSuccess: integer,
    checkpointFailure: integer,
    idleThreshold: positive,
    idleAdvance: integer,
    sharedAdvance: integer,
    randomSides: positive,
    globalRetreat: integer,
    globalAdvance: integer,
  }),
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
        kind: { enum: directionalHazardCardKinds },
        moveDelta: integer,
        effects: array(ref('effect')),
      },
      ['id', 'title', 'text', 'kind', 'effects'],
    ),
    1,
  ),
});

export const jsonDirectionalHazardRaceSchema = {
  ...requiredSchema,
  properties: {
    ...requiredSchema.properties,
    victoryMode: { enum: ['arrival', 'external'] },
  },
};

export function assertDirectionalHazardRaceReferences(
  program: DirectionalHazardRaceProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  counters: ReadonlySet<string>,
) {
  const fail = authoringFailure(
    'game.json.directionalHazardRace',
    program,
    'DirectionalHazard race: ',
  );
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('trackId', 'one tile per track position required');
  if (
    !components.some(
      (item) => item.component === 'dice.set' && item.id === program.diceId,
    )
  )
    fail('diceId', 'unknown dice');
  if (
    !components.some(
      (item) => item.component === 'cards.deck' && item.id === program.deckId,
    )
  )
    fail('deckId', 'unknown deck');
  for (const [field, resource] of Object.entries(program.resources))
    if (!resources.has(resource))
      fail(`resources.${field}`, `unknown resource ${resource}`);
  if (!counters.has(program.counterId)) fail('counterId', 'unknown counter');
  assertUniqueAuthorIds(program.cards, 'cards', fail);
}
