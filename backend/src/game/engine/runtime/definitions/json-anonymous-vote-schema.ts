import type { AnonymousVoteProgram } from '../effect-packs/choice-anonymous-vote/program';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

export const jsonAnonymousVoteSchema: AuthorSchema = object(
  {
    answerSubmissionId: id,
    voteSubmissionId: id,
    targetScore: { type: 'integer', minimum: 1, maximum: 1000 },
    winnerReason: id,
    challenges: array(
      object(
        {
          id,
          prompt: { type: 'string', minLength: 1, maxLength: 10000 },
          answers: {
            ...array({ type: 'string', minLength: 1, maxLength: 10000 }, 3),
            maxItems: 3,
          },
        },
        ['id', 'prompt', 'answers'],
      ),
      1,
    ),
  },
  [
    'answerSubmissionId',
    'voteSubmissionId',
    'targetScore',
    'winnerReason',
    'challenges',
  ],
);

export function assertAnonymousVoteReferences(
  program: AnonymousVoteProgram,
): void {
  const ids = program.challenges.map((challenge) => challenge.id);
  if (new Set(ids).size !== ids.length)
    throw new Error('AnonymousVote challenge identifiers must be unique');
  if (program.answerSubmissionId === program.voteSubmissionId)
    throw new Error('AnonymousVote submission identifiers must differ');
}
