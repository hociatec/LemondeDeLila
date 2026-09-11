import type { GameMatchController } from '../kits/match-kit';
import type { GameRoundController } from '../kits/round-kit';
import type { ContextConfigurationCapability } from './context-configuration-capability';
import type { ContextTurnCapability } from './context-turn-capability';
import type { PublicController } from './public-controller';

export interface ContextLifecycleCapability {
  readonly match: PublicController<GameMatchController>;
  readonly round: PublicController<GameRoundController>;
  readonly config: ContextConfigurationCapability;
  readonly turn: ContextTurnCapability;
  readonly phase: {
    current: () => string;
    is: (phaseId: string) => boolean;
    transitionTo: (phaseId: string) => void;
  };
  readonly transitionTo: (phase: string) => void;
}
