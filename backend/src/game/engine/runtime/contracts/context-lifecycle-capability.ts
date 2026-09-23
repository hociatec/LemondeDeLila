import type { GameMatchController } from '../kits/match-kit';
import type { GameRoundController } from '../kits/round-kit';
import type { ContextConfigurationCapability } from './context-configuration-capability';
import type { ContextTurnCapability } from './context-turn-capability';
import type { PublicController } from './public-controller';

export interface ContextLifecycleCapability {
  readonly match: PublicController<
    GameMatchController,
    | 'start'
    | 'lifecycle'
    | 'finish'
    | 'cancel'
    | 'eliminate'
    | 'setPlayerStatus'
    | 'playerStatus'
    | 'activePlayers'
    | 'result'
  >;
  readonly round: PublicController<
    GameRoundController,
    | 'number'
    | 'reset'
    | 'next'
    | 'start'
    | 'activePlayers'
    | 'status'
    | 'completed'
    | 'starter'
    | 'participants'
    | 'leftPlayers'
    | 'winners'
    | 'leave'
    | 'winner'
    | 'end'
  >;
  readonly config: ContextConfigurationCapability;
  readonly turn: ContextTurnCapability;
  readonly phase: {
    current: () => string;
    is: (phaseId: string) => boolean;
    transitionTo: (phaseId: string) => void;
  };
  readonly transitionTo: (phase: string) => void;
}
