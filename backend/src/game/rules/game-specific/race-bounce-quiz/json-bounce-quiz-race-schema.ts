import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { BounceQuizRaceProgram } from './program';
import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../../../engine/sdk/extension-api';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';

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
  const fail = authoringFailure('game.json.bounceQuizRace', program);
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === program.trackId,
  );
  if (track?.component !== 'movement.track') fail('trackId', 'unknown track');
  if (
    track?.component === 'movement.track' &&
    track.spaces !== program.tiles.length
  )
    fail('tiles', 'one tile per track position required');
  for (const [component, field] of [
    ['dice.set', 'diceId'],
    ['cards.deck', 'deckId'],
    ['pawn.set', 'pawnSetId'],
  ] as const)
    if (
      !components.some(
        (item) => item.component === component && item.id === program[field],
      )
    )
      fail(field, `unknown ${component} ${program[field]}`);
  for (const [index, tile] of program.tiles.entries())
    if (tile.n !== index + 1) fail(`tiles[${index}].n`, 'invalid tile order');
  if (program.tiles[0]?.type !== 'start')
    fail('tiles[0].type', 'start tile required');
  if (program.tiles.at(-1)?.type !== 'finish')
    fail(`tiles[${program.tiles.length - 1}].type`, 'finish tile required');
  assertUniqueAuthorIds(program.cards, 'cards', fail);
  for (const [index, card] of program.cards.entries())
    if (card.quiz && card.quiz.correctIndex >= card.quiz.choices.length)
      fail(
        `cards[${index}].quiz.correctIndex`,
        `answer outside choices on card ${card.id}`,
      );
}
