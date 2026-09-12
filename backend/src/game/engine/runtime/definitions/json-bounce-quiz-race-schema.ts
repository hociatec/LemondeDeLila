import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { BounceQuizRaceProgram } from '../effect-packs/race-bounce-quiz/program';
import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

const integer = { type: 'integer', minimum: -10000, maximum: 10000 } as const;
const text = { type: 'string', minLength: 1, maxLength: 10000 } as const;

export const jsonBounceQuizRaceSchema = object({
  trackId: id,
  diceId: id,
  deckId: id,
  pawnSetId: id,
  pawnChoiceId: id,
  answerChoiceId: id,
  maxDepth: positive,
  finishReason: id,
  statuses: object({
    ignoreNextMalus: id,
    ignoreNextSkip: id,
    forceDrawNextTurn: id,
  }),
  tiles: array(
    object({
      n: positive,
      title: text,
      type: { enum: ['start', 'neutral', 'card', 'move', 'skip', 'finish'] },
      delta: integer,
      skipTurns: { type: 'integer', minimum: 0, maximum: 1000 },
    }),
    2,
  ),
  cards: array(
    object(
      {
        id: positive,
        title: text,
        effects: array(ref('effect')),
        quiz: object(
          {
            prompt: text,
            choices: array(text, 3),
            correctIndex: { type: 'integer', minimum: 0, maximum: 100 },
            successDelta: integer,
            failureDelta: integer,
            anyCorrect: boolean,
          },
          ['prompt', 'choices', 'correctIndex', 'successDelta', 'failureDelta'],
        ),
      },
      ['id', 'title', 'effects'],
    ),
    1,
  ),
});

export function assertBounceQuizRaceReferences(
  program: BounceQuizRaceProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`BounceQuiz race: ${reason}`);
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
  for (const [component, value] of [
    ['dice.set', program.diceId],
    ['cards.deck', program.deckId],
    ['pawn.set', program.pawnSetId],
  ] as const)
    if (
      !components.some(
        (item) => item.component === component && item.id === value,
      )
    )
      fail(`unknown ${component} ${value}`);
  if (program.tiles.some((tile, index) => tile.n !== index + 1))
    fail('invalid tile order');
  if (
    program.tiles[0]?.type !== 'start' ||
    program.tiles.at(-1)?.type !== 'finish'
  )
    fail('invalid track endpoints');
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('duplicate card id');
  for (const card of program.cards)
    if (card.quiz && card.quiz.correctIndex >= card.quiz.choices.length)
      fail(`answer outside choices on card ${card.id}`);
}
