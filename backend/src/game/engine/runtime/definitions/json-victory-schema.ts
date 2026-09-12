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
  'track-zone-collection',
  'resource-track-race',
  'treasure-track-race',
  'parade',
  'family-request',
  'car-assembly',
  'paw-scoring',
  'market-exchange',
  'paired-pawn-race',
  'card-circles',
  'public-domain-cards',
  'protected-haunted-race',
  'bidirectional-collision-race',
  'family-effects',
  'team-pawn-race',
  'quiz-event-race',
  'theme-name-cards',
  'ritual-phases',
  'property-economy',
  'bounce-quiz-race',
  'species-troops',
  'directional-hazard-race',
  'anonymous-vote',
  'shared-prestige-cards',
  'simultaneous-quiz',
  'path-walls',
  'story-challenge',
  'discard-penalty-cards',
  'chapter-encounter',
  'battle-ties',
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
