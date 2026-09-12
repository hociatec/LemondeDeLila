import type { MamanRaceProgram } from '../extensions/maman-race/program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

const tileType = {
  enum: [
    'start',
    'neutral',
    'token',
    'card',
    'bonds',
    'slide',
    'storm',
    'nest',
    'meeting',
    'finish',
  ],
} as const;

export const jsonMamanRaceSchema = object({
  trackId: id,
  diceId: id,
  deckId: id,
  tokenResource: id,
  bonusRerollStatus: id,
  tokensToWin: positive,
  maxDepth: positive,
  finishReason: id,
  eventNamespace: id,
  tiles: array(
    object({
      id: { type: 'integer', minimum: 0, maximum: 10000 },
      title: { type: 'string', minLength: 1, maxLength: 2000 },
      description: { type: 'string', maxLength: 10000 },
      type: tileType,
    }),
    2,
  ),
  cards: array(
    object({
      id: { type: 'integer', minimum: 0, maximum: 1000000 },
      text: { type: 'string', minLength: 1, maxLength: 10000 },
      effects: array(ref('effect')),
    }),
    1,
  ),
});

export function assertMamanRaceReferences(
  program: MamanRaceProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Maman race: ${reason}`);
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
  if (!resources.has(program.tokenResource)) fail('unknown token resource');
  if (program.tiles.at(-1)?.type !== 'finish') fail('last tile must be finish');
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('duplicate card id');
}
