import type {
  DeclarativeGameDefinition,
  DeclarativeState,
  GameActionMap,
} from './game-definition';
import type { GameRuleContext } from './game-rule-context';

export class DeclarativeLifecycle<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
> {
  constructor(
    private readonly definition: DeclarativeGameDefinition<
      TState,
      TActions,
      TPlayerView
    >,
  ) {}

  enterInitialPhase(
    runtime: DeclarativeState<TState>,
    context: GameRuleContext<TState>,
  ): void {
    const phase = this.definition.phases?.[runtime.phase];
    const entered = phase?.enter?.({ state: runtime.game, ctx: context });
    if (entered) context.replaceState(entered);
  }

  stabilize(
    runtime: DeclarativeState<TState>,
    context: GameRuleContext<TState>,
  ): void {
    for (let iteration = 0; iteration < 32; iteration += 1) {
      if (this.finishIfVictorious(runtime, context)) return;
      if (this.applyAutomaticRule(runtime, context)) continue;
      if (this.transitionAutomaticPhase(runtime, context)) continue;
      return;
    }
    throw new Error(
      `Boucle automatique non convergente: ${this.definition.id}`,
    );
  }

  private finishIfVictorious(
    runtime: DeclarativeState<TState>,
    context: GameRuleContext<TState>,
  ): boolean {
    if (!this.definition.victory) return false;
    const result = this.definition.victory.evaluate({
      state: runtime.game,
      ctx: context,
    });
    if (!result) return false;
    runtime.status = 'finished';
    runtime.engine.status = 'finished';
    runtime.extras = { ...(runtime.extras ?? {}), victory: result };
    context.events.emit('game.finished', result);
    return true;
  }

  private applyAutomaticRule(
    runtime: DeclarativeState<TState>,
    context: GameRuleContext<TState>,
  ): boolean {
    const rule = this.definition.automatic?.find((candidate) =>
      candidate.when({ state: runtime.game, ctx: context }),
    );
    if (!rule) return false;
    const next = rule.apply({ state: runtime.game, ctx: context });
    if (next) context.replaceState(next);
    context.events.emit('game.automatic', { ruleId: rule.id });
    return true;
  }

  private transitionAutomaticPhase(
    runtime: DeclarativeState<TState>,
    context: GameRuleContext<TState>,
  ): boolean {
    const phase = this.definition.phases?.[runtime.phase];
    if (
      !phase?.next ||
      !phase.autoTransition?.({ state: runtime.game, ctx: context })
    ) {
      return false;
    }
    const exited = phase.exit?.({ state: runtime.game, ctx: context });
    if (exited) context.replaceState(exited);
    context.transitionTo(phase.next);
    const entered = this.definition.phases?.[phase.next]?.enter?.({
      state: runtime.game,
      ctx: context,
    });
    if (entered) context.replaceState(entered);
    context.events.emit('game.phase.changed', { phase: phase.next });
    return true;
  }
}
