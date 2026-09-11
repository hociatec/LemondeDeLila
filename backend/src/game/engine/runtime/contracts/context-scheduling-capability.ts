import type { GameSchedulerController } from '../automation/scheduler-kit';
import type { PublicController } from './public-controller';

export interface ContextSchedulingCapability {
  readonly scheduler: PublicController<GameSchedulerController>;
}
