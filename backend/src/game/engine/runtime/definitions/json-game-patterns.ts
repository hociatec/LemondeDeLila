import { raceGame } from '../patterns/gameplay-pattern-track-card';
import {
  pushYourLuck,
  simultaneousAnswers,
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
  | { kind: 'simultaneous-answers' };

const position: AuthorSchema = { type: 'integer', minimum: 0 };
export const jsonGamePatternSchema: AuthorSchema = {
  oneOf: [
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
    object({ kind: { const: 'simultaneous-answers' } }),
  ],
};

export function compileJsonPattern(
  pattern: JsonGamePattern,
): GamePattern<Record<string, never>> {
  switch (pattern.kind) {
    case 'race': {
      const { kind: _kind, ...options } = pattern;
      return raceGame(options);
    }
    case 'push-your-luck':
      return pushYourLuck();
    case 'simultaneous-answers':
      return simultaneousAnswers();
  }
}
