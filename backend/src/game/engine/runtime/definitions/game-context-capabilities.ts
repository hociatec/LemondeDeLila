import type { ContextPlayersCapability } from '../contracts/context-players-capability';
import type { ContextLifecycleCapability } from '../contracts/context-lifecycle-capability';
import type { ContextValuesCapability } from '../contracts/context-values-capability';
import type { ContextComponentsCapability } from '../contracts/context-components-capability';
import type { ContextInteractionsCapability } from '../contracts/context-interactions-capability';
import type { ContextSchedulingCapability } from '../contracts/context-scheduling-capability';
import type { GameExecutionContext } from '../../../core/application/models/game-execution-context.model';
import type { GameContextEvents } from '../events/game-context-events';
import type { ContextEffectCapability } from '../contracts/context-effect-capability';
export type { PublicController } from '../contracts/public-controller';

/** Runtime implements the independently owned capability contracts. */
export interface GameContextCapabilities<TState extends object>
  extends
    ContextPlayersCapability,
    ContextLifecycleCapability,
    ContextValuesCapability,
    ContextComponentsCapability,
    ContextInteractionsCapability,
    ContextSchedulingCapability {
  readonly random: GameExecutionContext['rng'];
  readonly clock: GameExecutionContext['clock'];
  readonly commandId: string | null;
  readonly effects: ContextEffectCapability;
  readonly events: GameContextEvents['api'];
  readonly reject: (
    code: string,
    details?: Readonly<Record<string, unknown>>,
    message?: string,
  ) => never;
  readonly state: TState;
}
