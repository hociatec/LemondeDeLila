import type { PairedPawnRaceProgram } from '../effect-packs/race-paired-pawns/program';
import type { GameComponentDefinition } from '../../engine/runtime/definitions/component-kit';
import {
  authorArray as array,
  authorId as id,
  authorRecord as record,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../../engine/runtime/contracts/json-author-schema';
import { GameConfigurationError } from '../../core/domain/errors/game-domain.errors';

const tileType = id;

export const jsonPairedPawnRaceSchema = object({
  tileRules: record(
    object({
      kind: {
        enum: ['none', 'gain', 'draw', 'move', 'skip', 'meeting', 'finish'],
      },
      amount: { type: 'integer' },
    }),
  ),
  transferAmount: positive,
  sharedAdvance: { type: 'integer' },
  meetingAdvance: { type: 'integer' },
  rollMinimum: positive,
  rollAdvance: { type: 'integer' },
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

export function assertPairedPawnRaceReferences(
  program: PairedPawnRaceProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`PairedPawn race: ${reason}`);
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
  if (
    program.tiles.some((tile) => !Object.hasOwn(program.tileRules, tile.type))
  )
    fail('unknown tile rule');
  if (program.tileRules[program.tiles.at(-1)?.type ?? '']?.kind !== 'finish')
    fail('last tile must be finish');
  if (
    Object.values(program.tileRules).some(
      (rule) =>
        (rule.kind === 'skip' && rule.amount < 1) ||
        (rule.kind === 'gain' && rule.amount < 0),
    )
  )
    fail('invalid rule amount');
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('duplicate card id');
}
