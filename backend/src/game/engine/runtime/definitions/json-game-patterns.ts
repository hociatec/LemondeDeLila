import { raceGame, pawnRace } from '../patterns/gameplay-pattern-track-card';
import {
  pushYourLuck,
  simultaneousAnswers,
  marketGame,
  submissionJudgeGame,
} from '../patterns/gameplay-pattern-round-economy';
import type { GamePattern } from '../contracts/pattern-definition';
import type { GameEffectInstruction } from '../contracts/effect-ir';
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
  | ({ kind: 'pawn-race' } & Parameters<typeof pawnRace>[0])
  | {
      kind: 'race';
      trackId: string;
      spaces: number;
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
    }
  | { kind: 'push-your-luck' }
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
      },
      ['kind', 'pawnSetId', 'pawns', 'spaces'],
    ),
    object(
      {
        kind: { const: 'race' },
        trackId: id,
        spaces: { type: 'integer', minimum: 1, maximum: 10000 },
        overshoot: { enum: ['clamp', 'wrap', 'bounce', 'exact'] },
        finish: position,
        homeStretch: object({ from: position, to: position }, ['from']),
        landingEffects: record(array(ref('effect'))),
        diceId: id,
        diceCount: { type: 'integer', minimum: 1, maximum: 100 },
        diceSides: { type: 'integer', minimum: 2, maximum: 1000000 },
        winOnFinish: { oneOf: [boolean, id] },
      },
      ['kind', 'trackId', 'spaces'],
    ),
    object({ kind: { const: 'push-your-luck' } }),
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
