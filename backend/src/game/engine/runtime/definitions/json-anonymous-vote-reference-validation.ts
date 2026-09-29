import type { JsonGamePattern } from './json-game-patterns';

type Failure = (path: string, reason: string) => never;

export function assertAnonymousVoteReferences(
  pattern: Extract<JsonGamePattern, { kind: 'anonymous-vote' }>,
  index: number,
  fail: Failure,
): void {
  const root = `patterns[${index}]`;
  if (pattern.answerSubmissionId === pattern.voteSubmissionId)
    fail(`${root}.voteSubmissionId`, 'submission identifiers must differ');
  const ids = new Set<string>();
  for (const [challengeIndex, challenge] of pattern.challenges.entries()) {
    if (ids.has(challenge.id))
      fail(`${root}.challenges[${challengeIndex}].id`, 'duplicate challenge');
    ids.add(challenge.id);
  }
}
