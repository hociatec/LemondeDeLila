import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { CatPattesProgram } from '../extensions/cat-pattes/program';
import { effectJsonSchema } from '../contracts/effect-json-schema';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const base = {
  id,
  name: text,
  description: text,
  effect: text,
  effects: effectJsonSchema,
};

export const jsonCatPattesSchema: AuthorSchema = object({
  deckId: id,
  handId: id,
  trackId: id,
  goal: { type: 'integer', minimum: 1, maximum: 1000000 },
  initialHandSize: { type: 'integer', minimum: 1, maximum: 100 },
  defaultRounds: { type: 'integer', minimum: 1, maximum: 20 },
  statusPrefix: id,
  cards: array(
    {
      oneOf: [
        object(
          {
            ...base,
            type: { const: 'pattes' },
            value: { type: 'integer', minimum: 1, maximum: 1000000 },
          },
          ['id', 'name', 'type', 'value', 'effects'],
        ),
        object(
          {
            ...base,
            type: { const: 'obstacle' },
            obstacle: {
              enum: ['gamelle', 'pluie', 'chien', 'coussin', 'sol'],
            },
          },
          ['id', 'name', 'type', 'obstacle', 'effects'],
        ),
        object(
          {
            ...base,
            type: { const: 'parade' },
            parade: {
              enum: ['croquettes', 'rayon', 'dodo', 'coussin', 'saut'],
            },
          },
          ['id', 'name', 'type', 'parade', 'effects'],
        ),
        object(
          {
            ...base,
            type: { const: 'bot' },
            bot: {
              enum: ['reserve', 'chat-ninja', 'patte-blindee', 'passage-star'],
            },
          },
          ['id', 'name', 'type', 'bot', 'effects'],
        ),
      ],
    },
    1,
  ),
});

export function assertCatPattesReferences(program: CatPattesProgram): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError('Cat Pattes: ' + reason);
  };
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('card identifiers must be unique');
  if (program.initialHandSize * 2 > program.cards.length)
    fail('deck cannot deal the minimum player hands');
  for (const card of program.cards) {
    if (card.type === 'pattes' && card.value > program.goal)
      fail('card ' + card.id + ' exceeds the goal');
  }
}
