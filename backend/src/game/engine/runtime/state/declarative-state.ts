import type { GameState } from '../../../core/application/models/game-state.model';
import type { CardsKitState } from '../cards/cards-kit';
import type { InventoryKitState } from '../kits/inventory-kit';
import type { EconomyKitState } from '../kits/economy-kit';
import type { OwnershipKitState } from '../kits/ownership-kit';
import type { DiceKitState } from '../kits/dice-kit';
import type { GridKitState } from '../kits/grid-kit';
import type { MovementKitState } from '../kits/movement-kit';
import type { QuizKitState } from '../kits/quiz-kit';
import type { PawnKitState } from '../kits/pawn-kit';
import type { GamePendingEvent } from '../../../core/application/models/game-event.model';
import type { MatchKitState } from '../kits/match-kit';
import type { RoundKitState } from '../kits/round-kit';
import type { PlayerValuesKitState } from '../kits/player-values-kit';
import type { GameConfigurationState } from '../contracts/configuration-state';
import type { EffectEngineState } from '../contracts/effect-ir';
import type { GameCommandJournalState } from '../actions/game-command-journal';
import type { SubmissionKitState } from '../submissions/submission-kit';
import type { GameSchedulerState } from '../automation/scheduler-kit';

export type DeclarativeState<TState extends object> = GameState & {
  game: TState;
  engine: {
    algorithmVersion?: string;
    schemaVersion: number;
    contentVersion: string;
    contentDigest?: string;
    rulesVersion: string;
    kits: EngineKitsState;
    pendingEvents?: GamePendingEvent[];
    match: MatchKitState;
    round: RoundKitState;
    playerValues: PlayerValuesKitState;
    configuration: GameConfigurationState;
    effects: EffectEngineState;
    commands: GameCommandJournalState;
    submissions: SubmissionKitState;
    scheduler: GameSchedulerState;
  };
};

export type GameSession<TState extends object> = DeclarativeState<TState>;

export type EngineKitsState = {
  cards?: CardsKitState;
  inventory?: InventoryKitState;
  economy?: EconomyKitState;
  ownership?: OwnershipKitState;
  movement?: MovementKitState;
  pawns?: PawnKitState;
  dice?: DiceKitState;
  grid?: GridKitState;
  quiz?: QuizKitState;
};
