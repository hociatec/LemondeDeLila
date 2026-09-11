import type { GameChoiceController } from '../choices/game-choice-controller';
import type {
  GameSubmissionController,
  GameSubmissionFlowController,
  GameJudgeController,
  GameVotingController,
} from '../submissions/submission-kit';
import type { PublicController } from './public-controller';

export interface ContextInteractionsCapability {
  readonly choice: PublicController<GameChoiceController>;
  readonly submissions: PublicController<GameSubmissionController>;
  readonly submissionFlow: PublicController<GameSubmissionFlowController>;
  readonly judge: PublicController<GameJudgeController>;
  readonly voting: PublicController<GameVotingController>;
}
