import type { GameContext } from '../game-rule-context';
import type { GameSingleActionDto } from '../../../core/application/contracts/game-action.model';
import type { SchedulerVisibility } from '../automation/scheduler-kit';

export interface PhaseConfiguration<TState extends object> {
  readonly actions?: readonly string[];
  readonly visibility?: 'public' | 'hidden';
  readonly enter?: (input: { state: TState; ctx: GameContext<TState> }) => void;
  readonly exit?: (input: { state: TState; ctx: GameContext<TState> }) => void;
  readonly next?: string;
  readonly autoTransition?: (input: {
    state: TState;
    ctx: GameContext<TState>;
  }) => boolean;
  readonly timeout?: {
    afterMs: number;
    action: GameSingleActionDto;
    visibility?: SchedulerVisibility;
  };
}

export function phase<TState extends object>(
  configuration: PhaseConfiguration<TState>,
): PhaseConfiguration<TState> {
  return Object.freeze(configuration);
}

export type GamePhaseId<TPhaseSet> = TPhaseSet extends {
  readonly phases: Readonly<Record<infer TId, unknown>>;
}
  ? TId & string
  : never;

export type GamePhaseSet<TState extends object, TId extends string> = {
  readonly initialPhase: TId;
  readonly phases: Readonly<Record<TId, PhaseConfiguration<TState>>>;
  current(ctx: GameContext<TState>): TId;
  is(ctx: GameContext<TState>, phaseId: TId): boolean;
  transition(ctx: GameContext<TState>, phaseId: TId): void;
};

export function defineGamePhases<TState extends object>() {
  return <
    const TPhases extends Readonly<Record<string, PhaseConfiguration<TState>>>,
    const TInitial extends keyof TPhases & string,
  >(definition: {
    initialPhase: TInitial;
    phases: TPhases;
  }) => {
    type PhaseId = keyof TPhases & string;
    const phaseIds = new Set(Object.keys(definition.phases));
    const current = (ctx: GameContext<TState>): PhaseId => {
      const phaseId = ctx.phase.current();
      if (!phaseIds.has(phaseId)) {
        ctx.reject(
          'UNKNOWN_PHASE',
          { phase: phaseId },
          `Phase inconnue: ${phaseId}`,
        );
      }
      return phaseId;
    };
    return Object.freeze({
      initialPhase: definition.initialPhase,
      phases: Object.freeze({ ...definition.phases }),
      current,
      is: (ctx: GameContext<TState>, phaseId: PhaseId) =>
        current(ctx) === phaseId,
      transition: (ctx: GameContext<TState>, phaseId: PhaseId) =>
        ctx.transitionTo(phaseId),
    });
  };
}

export function setupPlayingPhases<TState extends object>() {
  return defineGamePhases<TState>()({
    initialPhase: 'setup',
    phases: { setup: {}, playing: {} },
  });
}
