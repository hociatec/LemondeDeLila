import { raceGame, pawnRace } from '../patterns/gameplay-pattern-track-card';
import {
  pushYourLuck,
  simultaneousAnswers,
  marketGame,
  submissionJudgeGame,
} from '../patterns/gameplay-pattern-round-economy';
import type { GamePattern } from '../contracts/pattern-definition';
import type { DeclarativeTrigger } from '../contracts/declarative-trigger';
import { declarativeTriggerFields } from '../contracts/declarative-trigger-schema';
import { triggerPattern } from '../automation/trigger-pattern';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import {
  orderedCardCollection,
  type OrderedCardCollectionOptions,
} from '../patterns/ordered-card-collection-pattern';
import {
  type AuthorSchema,
  authorId as id,
  authorBoolean as boolean,
  authorObject as object,
  authorRecord as record,
  authorArray as array,
  authorRef as ref,
} from '../contracts/json-author-schema';

export type JsonGamePattern =
  | ({ kind: 'trigger' } & DeclarativeTrigger)
  | ({ kind: 'pawn-race' } & Parameters<typeof pawnRace>[0])
  | {
      kind: 'race';
      trackId: string;
      spaces: number;
      positionDisplayOffset?: number;
      overshoot?: 'clamp' | 'wrap' | 'bounce' | 'exact';
      finish?: number;
      homeStretch?: { from: number; to?: number };
      landingEffects?: Readonly<
        Record<number, readonly GameEffectInstruction[]>
      >;
      diceId?: string;
      diceCount?: number;
      diceSides?: number;
      winOnFinish?: boolean | string;
      delivery?: NonNullable<Parameters<typeof raceGame>[0]['delivery']>;
    }
  | { kind: 'push-your-luck' }
  | ({ kind: 'ordered-card-collection' } & OrderedCardCollectionOptions)
  | {
      kind: 'market';
      marketId: string;
      inventoryId: string;
      items: readonly string[];
      currency: string;
      prices: Readonly<Record<string, number>>;
      startingCurrency: number;
      minPrice: number;
      maxPrice: number;
      turnsCounterId: string;
      maxRounds: number;
      winnerReason: string;
    }
  | { kind: 'simultaneous-answers' }
  | {
      kind: 'submission-judge';
      submissionId?: string;
      voteId?: string;
      secret?: boolean;
      targetScore?: number;
      winnerReason?: string;
    };

const position: AuthorSchema = { type: 'integer', minimum: 0 };
export const jsonGamePatternSchema: AuthorSchema = {
  oneOf: [
    object({ kind: { const: 'trigger' }, ...declarativeTriggerFields }, [
      'kind',
      'id',
      'on',
      'effects',
    ]),
    object(
      {
        kind: { const: 'pawn-race' },
        pawnSetId: id,
        pawns: array(
          object({ id, label: { type: 'string' }, name: { type: 'string' } }, [
            'id',
          ]),
          1,
        ),
        perPlayer: { type: 'integer', minimum: 1, maximum: 1000 },
        spaces: { type: 'integer', minimum: 1, maximum: 10000 },
        overshoot: { enum: ['clamp', 'wrap', 'bounce', 'exact'] },
        initialPosition: { type: 'integer', minimum: -1, maximum: 10000 },
        entryRoll: { type: 'integer', minimum: 1, maximum: 100000000 },
        entryPosition: position,
        exactFinish: boolean,
        homeStretchFrom: position,
        diceId: id,
        diceCount: { type: 'integer', minimum: 1, maximum: 100 },
        diceSides: { type: 'integer', minimum: 2, maximum: 1000000 },
        play: object(
          {
            recipe: id,
            choiceId: id,
            finishAt: position,
            finishReason: id,
            extraTurnRolls: array({
              type: 'integer',
              minimum: 1,
              maximum: 100000000,
            }),
          },
          ['recipe', 'choiceId', 'finishAt', 'finishReason'],
        ),
      },
      ['kind', 'pawnSetId', 'pawns', 'spaces'],
    ),
    object(
      {
        kind: { const: 'race' },
        trackId: id,
        spaces: { type: 'integer', minimum: 1, maximum: 10000 },
        positionDisplayOffset: {
          type: 'integer',
          minimum: -1000000,
          maximum: 1000000,
        },
        overshoot: { enum: ['clamp', 'wrap', 'bounce', 'exact'] },
        finish: position,
        homeStretch: object({ from: position, to: position }, ['from']),
        landingEffects: record(array(ref('effect'))),
        diceId: id,
        diceCount: { type: 'integer', minimum: 1, maximum: 100 },
        diceSides: { type: 'integer', minimum: 2, maximum: 1000000 },
        winOnFinish: { oneOf: [boolean, id] },
        delivery: object(
          {
            recipe: id,
            clientDeckId: id,
            clientHandId: id,
            eventDeckId: id,
            destinationAttribute: id,
            blockedPositionAttribute: id,
            positionOffset: {
              type: 'integer',
              minimum: -10000,
              maximum: 10000,
            },
            targetScore: {
              type: 'integer',
              minimum: 1,
              maximum: 1000000,
            },
            finishReason: id,
            eventNamespace: id,
          },
          [
            'recipe',
            'clientDeckId',
            'clientHandId',
            'eventDeckId',
            'destinationAttribute',
            'blockedPositionAttribute',
            'positionOffset',
            'targetScore',
            'finishReason',
            'eventNamespace',
          ],
        ),
      },
      ['kind', 'trackId', 'spaces'],
    ),
    object({ kind: { const: 'push-your-luck' } }),
    object(
      {
        kind: { const: 'ordered-card-collection' },
        playRecipe: id,
        passRecipe: id,
        deckId: id,
        handId: id,
        cards: array(
          object(
            {
              id,
              name: { type: 'string', minLength: 1, maxLength: 2000 },
              value: id,
              special: boolean,
            },
            ['id', 'name', 'value', 'special'],
          ),
          1,
        ),
        sequence: array(id, 1),
        rewards: record(record({ type: 'number' })),
        resourceValues: record({ type: 'number' }),
        finishReason: id,
        eventNamespace: id,
      },
      [
        'kind',
        'playRecipe',
        'passRecipe',
        'deckId',
        'handId',
        'cards',
        'sequence',
        'rewards',
        'resourceValues',
        'finishReason',
        'eventNamespace',
      ],
    ),
    object(
      {
        kind: { const: 'market' },
        marketId: id,
        inventoryId: id,
        items: array(id, 1),
        currency: id,
        prices: record({ type: 'integer', minimum: 0, maximum: 1000000 }),
        startingCurrency: { type: 'integer', minimum: 0, maximum: 1000000 },
        minPrice: { type: 'integer', minimum: 0, maximum: 1000000 },
        maxPrice: { type: 'integer', minimum: 0, maximum: 1000000 },
        turnsCounterId: id,
        maxRounds: { type: 'integer', minimum: 1, maximum: 10000 },
        winnerReason: id,
      },
      [
        'kind',
        'marketId',
        'inventoryId',
        'items',
        'currency',
        'prices',
        'startingCurrency',
        'minPrice',
        'maxPrice',
        'turnsCounterId',
        'maxRounds',
        'winnerReason',
      ],
    ),
    object({ kind: { const: 'simultaneous-answers' } }),
    object(
      {
        kind: { const: 'submission-judge' },
        submissionId: id,
        voteId: id,
        secret: boolean,
        targetScore: { type: 'integer', minimum: 1, maximum: 1000000 },
        winnerReason: id,
      },
      ['kind'],
    ),
  ],
};

export function compileJsonPattern(
  pattern: JsonGamePattern,
): GamePattern<Record<string, never>> {
  switch (pattern.kind) {
    case 'trigger': {
      const { kind: _kind, ...rule } = pattern;
      return triggerPattern(rule);
    }
    case 'pawn-race': {
      const { kind: _kind, ...options } = pattern;
      return pawnRace(options);
    }
    case 'race': {
      const { kind: _kind, ...options } = pattern;
      return raceGame(options);
    }
    case 'push-your-luck':
      return pushYourLuck();
    case 'ordered-card-collection': {
      const { kind: _kind, ...options } = pattern;
      return orderedCardCollection(options);
    }
    case 'market': {
      const { kind: _kind, ...options } = pattern;
      return marketGame(options);
    }
    case 'simultaneous-answers':
      return simultaneousAnswers();
    case 'submission-judge': {
      const { kind: _kind, ...options } = pattern;
      return submissionJudgeGame(options);
    }
  }
}
