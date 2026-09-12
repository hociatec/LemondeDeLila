import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { ContesProgram } from '../contracts/contes-program';
import { effectJsonSchema } from '../contracts/effect-json-schema';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const cardType = { enum: ['bonus', 'malus', 'surprise', 'conte'] } as const;
const card = object({
  id: { type: 'integer', minimum: 1, maximum: 1000000 },
  type: cardType,
  title: text,
  text,
  effects: effectJsonSchema,
});

export const jsonContesSchema: AuthorSchema = object({
  trackId: id,
  pawnSetId: id,
  pawnChoiceId: id,
  resolutionFlag: id,
  maxChainDepth: { type: 'integer', minimum: 1, maximum: 100 },
  resources: object({ reroll: id, shield: id }),
  statuses: object({
    protectNextMalus: id,
    cape: id,
    replaceOne: id,
    noBonus: id,
    forcedOne: id,
    reverseNextTurn: id,
    blocked: id,
    keyOfGold: id,
  }),
  tiles: array(
    object({
      id,
      type: {
        enum: ['start', 'conte', 'bonus', 'malus', 'surprise', 'finish'],
      },
      label: text,
      description: text,
    }),
    2,
  ),
  pawns: array(object({ id: text, label: text, description: text }), 2),
  decks: object({
    bonus: array(card, 1),
    malus: array(card, 1),
    surprise: array(card, 1),
    conte: array(card, 1),
  }),
});

export function assertContesReferences(program: ContesProgram): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError('Contes: ' + reason);
  };
  if (
    program.tiles[0]?.type !== 'start' ||
    program.tiles.at(-1)?.type !== 'finish'
  )
    fail('track requires start and finish boundaries');
  if (
    new Set(program.pawns.map((pawn) => pawn.id)).size !== program.pawns.length
  )
    fail('pawn identifiers must be unique');
  for (const [type, cards] of Object.entries(program.decks)) {
    if (new Set(cards.map((entry) => entry.id)).size !== cards.length)
      fail('card identifiers must be unique within each deck');
    if (cards.some((entry) => entry.type !== type))
      fail('card type must match its deck');
  }
}
