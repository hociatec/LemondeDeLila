import {
  GameSubmissionController,
  type SubmissionFlowStage,
} from './submission-controller';
import { GameJudgeController } from './submission-judge-controller';
import { GameVotingController } from './submission-voting-controller';

export class GameSubmissionFlowController {
  constructor(
    private readonly submissions: GameSubmissionController,
    private readonly voting: GameVotingController,
    private readonly judge: GameJudgeController,
    private readonly simultaneous: {
      waitForAll(sessionId: string): void;
      completeWaiting(sessionId: string): boolean;
    },
  ) {}

  open(options: {
    id: string;
    players?: readonly number[];
    secret?: boolean;
    waitForAll?: boolean;
    replace?: boolean;
  }): void {
    if (options.replace !== false && this.submissions.has(options.id)) {
      this.submissions.clear(options.id);
    }
    this.submissions.open(options);
    if (options.waitForAll) this.simultaneous.waitForAll(options.id);
  }

  openForJudge(options: {
    submissionId: string;
    judgeId: string;
    players: readonly number[];
    secret?: boolean;
    rotateJudge?: boolean;
    waitForAll?: boolean;
  }): { judgePlayerId: number; participantPlayerIds: number[] } {
    const judgePlayerId = options.rotateJudge
      ? this.judge.next(options.judgeId)
      : this.judge.current(options.judgeId);
    const participantPlayerIds = options.players.filter(
      (playerId) => playerId !== judgePlayerId,
    );
    this.open({
      id: options.submissionId,
      players: participantPlayerIds,
      secret: options.secret,
      waitForAll: options.waitForAll,
    });
    return { judgePlayerId, participantPlayerIds };
  }

  submit<TValue>(id: string, playerId: number, value: TValue): boolean {
    this.submissions.submit(id, playerId, value);
    return this.submissions.isComplete(id);
  }

  vote<TValue>(id: string, playerId: number, value: TValue): boolean {
    this.voting.vote(id, playerId, value);
    return this.voting.isComplete(id);
  }

  completeWaiting(id: string): boolean {
    return this.simultaneous.completeWaiting(id);
  }

  reveal<TValue>(id: string): Record<string, TValue> {
    return this.submissions.reveal<TValue>(id);
  }

  revealAndOpenVote<TValue>(options: {
    submissionId: string;
    voteId: string;
    choices?: readonly unknown[];
    voters?: readonly number[];
    secret?: boolean;
    waitForAll?: boolean;
  }): Record<string, TValue> {
    const submissions = this.reveal<TValue>(options.submissionId);
    if (this.voting.has(options.voteId)) this.voting.clear(options.voteId);
    this.voting.open({
      id: options.voteId,
      players: options.voters,
      choices:
        options.choices ??
        Object.keys(submissions).map((playerId) => +playerId),
      secret: options.secret,
    });
    if (options.waitForAll) this.simultaneous.waitForAll(options.voteId);
    return submissions;
  }

  startJudge(
    id: string,
    options: { players?: readonly number[]; starterPlayerId?: number } = {},
  ): number {
    return this.judge.has(id)
      ? this.judge.current(id)
      : this.judge.start(id, options);
  }

  nextJudge(id: string): number {
    return this.judge.next(id);
  }

  stage(submissionId: string, voteId?: string): SubmissionFlowStage {
    const vote = voteId ? this.voting.session(voteId) : null;
    if (vote) return vote.closed ? 'complete' : 'voting';
    const submission = this.submissions.session(submissionId);
    if (!submission) return 'idle';
    if (!submission.closed) return 'collecting';
    return submission.revealed ? 'revealed' : 'ready-to-reveal';
  }

  reset(...sessionIds: readonly string[]): void {
    for (const sessionId of sessionIds) {
      if (this.submissions.has(sessionId)) this.submissions.clear(sessionId);
    }
  }
}
