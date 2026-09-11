import type { GameClock } from '../../../core/application/models/game-execution-context.model';
import type { GameState } from '../../../core/application/models/game-state.model';
import { DeclarativeGameRuntime } from '../../../engine/runtime/declarative-game.runtime';
import type { GameActionMap } from '../../../engine/runtime/definitions/game-definition';
import { DeclarativeLifecycle } from '../../../engine/runtime/lifecycle/declarative-lifecycle';

export class ContractGameRuntime<
  TState extends object,
  TActions extends GameActionMap<TState>,
> extends DeclarativeGameRuntime<TState, TActions> {
  assertStabilized(state: GameState, clock: GameClock): void {
    const runtime = this.runtimeState(state);
    if (!runtime.engine.configuration.complete) return;
    const context = this.context(runtime, null, { clock });
    new DeclarativeLifecycle(this.definition).stabilize(runtime, context);
    if (
      JSON.stringify(runtime) !== JSON.stringify(state) ||
      context.consumeEvents().length
    ) {
      throw new Error('Repeated stabilization changed state or emitted events');
    }
  }
}
