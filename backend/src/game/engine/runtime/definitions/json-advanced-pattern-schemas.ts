import {
  type AuthorSchema,
  authorId as id,
  authorObject as object,
  authorRecord as record,
  authorArray as array,
} from '../contracts/json-author-schema';

const position: AuthorSchema = { type: 'integer', minimum: 0 };

export const gooseRacePatternSchema = object(
  {
    kind: { const: 'goose-race' },
    rollRecipe: id,
    trackId: id,
    diceId: id,
    playingPhase: id,
    wellStatus: id,
    finishReason: id,
    maxDepth: { type: 'integer', minimum: 1, maximum: 64 },
    bridgeDestination: position,
    tiles: array(
      object(
        {
          id,
          label: { type: 'string', minLength: 1, maxLength: 2000 },
          description: { type: 'string', maxLength: 10000 },
          type: id,
          turnsToSkip: { type: 'integer', minimum: 1, maximum: 1000 },
          backTo: position,
        },
        ['id', 'label', 'type'],
      ),
      2,
    ),
    pawnSelection: object({ setId: id, choiceId: id }, ['setId', 'choiceId']),
    escapeRolls: array({ type: 'integer', minimum: 1 }, 1),
    forwardRollMaximum: { type: 'integer', minimum: 0 },
    defaultReturn: position,
    defaultSkip: { type: 'integer', minimum: 1 },
    tileRules: record({
      enum: [
        'none',
        'finish',
        'move-to',
        'return',
        'skip',
        'roll-directed',
        'block',
        'repeat-roll',
      ],
    }),
  },
  [
    'kind',
    'rollRecipe',
    'trackId',
    'diceId',
    'playingPhase',
    'wellStatus',
    'finishReason',
    'maxDepth',
    'bridgeDestination',
    'tiles',
    'pawnSelection',
    'escapeRolls',
    'forwardRollMaximum',
    'defaultReturn',
    'defaultSkip',
    'tileRules',
  ],
);

export const cardBattlePatternSchema = object(
  {
    kind: { const: 'card-battle' },
    playRecipe: id,
    deckId: id,
    handId: id,
    totalCards: { type: 'integer', minimum: 1, maximum: 10000 },
    cards: array(
      object(
        {
          id,
          name: { type: 'string', minLength: 1, maxLength: 1000 },
          type: id,
          color: id,
          family: id,
          value: { type: 'number' },
          allowedFamilies: array(id),
        },
        ['id', 'name', 'type', 'color', 'value'],
      ),
      1,
    ),
  },
  ['kind', 'playRecipe', 'deckId', 'handId', 'totalCards', 'cards'],
);

export const trackZoneCollectionPatternSchema = object(
  {
    kind: { const: 'track-zone-collection' },
    rollRecipe: id,
    trackId: id,
    diceId: id,
    finishReason: id,
    eventNamespace: id,
    collectedEvent: id,
    tiles: array(
      object(
        {
          n: { type: 'integer', minimum: 1, maximum: 10000 },
          title: { type: 'string', minLength: 1, maxLength: 2000 },
          description: { type: 'string', maxLength: 10000 },
          type: { enum: ['card', 'finish'] },
        },
        ['n', 'title', 'type'],
      ),
      2,
    ),
    zones: array(
      object(
        {
          id: { type: 'integer', minimum: 1, maximum: 10000 },
          minimumTile: { type: 'integer', minimum: 1, maximum: 10000 },
          maximumTile: { type: 'integer', minimum: 1, maximum: 10000 },
          deckId: id,
          resourceId: id,
        },
        ['id', 'minimumTile', 'maximumTile', 'deckId', 'resourceId'],
      ),
      1,
    ),
  },
  [
    'kind',
    'rollRecipe',
    'trackId',
    'diceId',
    'finishReason',
    'eventNamespace',
    'collectedEvent',
    'tiles',
    'zones',
  ],
);
