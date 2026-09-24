import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { AnonymousVoteProgram } from './program';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../../../engine/sdk/extension-api';

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
            ...array({ type: 'string', minLength: 1, maxLength: 10000 }, 2),
            maxItems: 100,
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
  const fail = authoringFailure('game.json.anonymousVote', program);
  assertUniqueAuthorIds(program.challenges, 'challenges', fail);
  if (program.answerSubmissionId === program.voteSubmissionId)
    fail('voteSubmissionId', 'submission identifiers must differ');
}
