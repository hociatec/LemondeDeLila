import { standardVictorySchemas } from './json-standard-victory';
import {
  type AuthorSchema,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

const options = {
  participants: { enum: ['active', 'all'] },
  selection: {
    enum: ['all-qualified', 'unique-qualified', 'highest-value-lowest-id'],
  },
  reason: { type: 'string', minLength: 1, maxLength: 128 },
} satisfies Record<string, AuthorSchema>;

const programKinds = [
  'board',
  'grid',
  'judged-cards',
  'event-race',
  'delivery-race',
  'goose-race',
  'collection-race',
  'ecosystem-race',
  'pirate-race',
  'parade',
  'nature-families',
  'car-assembly',
  'cat-pattes',
  'wonder-market',
  'maman-race',
  'card-circles',
  'mine-domain',
  'frousse-race',
  'galopons-race',
  'profession-families',
  'foulees-race',
  'galaxy-race',
  'gerard',
  'rites',
  'sac',
  'midnight-race',
  'banana-troops',
  'derape-race',
  'nawak',
  'olympia',
  'mnemosyne',
  'corridor',
  'contes',
  'lama',
  'voyage',
  'zig-et-zag',
  'pawn-race',
] as const;

export const jsonVictorySchema: AuthorSchema = {
  oneOf: [
    ...programKinds.map((kind) => object({ kind: { const: `by-${kind}` } })),
    ...standardVictorySchemas,
    object(
      {
        kind: { const: 'resource-at-least' },
        resource: id,
        amount: { type: 'number', minimum: 1 },
        ...options,
      },
      ['kind', 'resource', 'amount'],
    ),
    object(
      {
        kind: { const: 'score-at-least' },
        amount: { type: 'number', minimum: 1 },
        ...options,
      },
      ['kind', 'amount'],
    ),
  ],
};
