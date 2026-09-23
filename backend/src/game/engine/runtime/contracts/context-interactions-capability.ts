import type { GameChoiceController } from '../choices/game-choice-controller';
import type {
  GameSubmissionController,
  GameSubmissionFlowController,
  GameJudgeController,
  GameVotingController,
} from '../submissions/submission-kit';
import type { PublicController } from './public-controller';

export interface ContextInteractionsCapability {
  readonly choice: PublicController<
    GameChoiceController,
    | 'number'
    | 'clear'
    | 'one'
    | 'many'
    | 'player'
    | 'card'
    | 'pawn'
    | 'ordering'
    | 'vote'
    | 'players'
    | 'confirm'
    | 'forPlayers'
    | 'sequence'
    | 'current'
    | 'replaceOptions'
    | 'continuation'
    | 'consumeContinuation'
    | 'resolvePlayer'
  >;
  readonly submissions: PublicController<
    GameSubmissionController,
    | 'has'
    | 'clear'
    | 'reveal'
    | 'session'
    | 'open'
    | 'submit'
    | 'replace'
    | 'pendingPlayers'
    | 'isComplete'
    | 'reorderPending'
    | 'values'
  >;
  readonly submissionFlow: PublicController<
    GameSubmissionFlowController,
    | 'reset'
    | 'reveal'
    | 'vote'
    | 'open'
    | 'submit'
    | 'openForJudge'
    | 'completeWaiting'
    | 'revealAndOpenVote'
    | 'startJudge'
    | 'nextJudge'
    | 'stage'
  >;
  readonly judge: PublicController<
    GameJudgeController,
    'has' | 'next' | 'current' | 'start' | 'setCurrent' | 'index'
  >;
  readonly voting: PublicController<
    GameVotingController,
    | 'has'
    | 'clear'
    | 'reveal'
    | 'session'
    | 'vote'
    | 'open'
    | 'submit'
    | 'replace'
    | 'pendingPlayers'
    | 'isComplete'
    | 'reorderPending'
    | 'values'
    | 'tally'
  >;
}
