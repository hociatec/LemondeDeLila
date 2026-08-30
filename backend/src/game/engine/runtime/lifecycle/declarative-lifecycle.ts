import type {
  CompiledGameDefinition,
  DeclarativeState,
  GameActionMap,
} from '../definitions/game-definition';
import type { GameContext } from '../game-rule-context';
import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';

export class DeclarativeLifecycle<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
> {
  constructor(
    private readonly definition: CompiledGameDefinition<
      TState,
      TActions,
      TPlayerView
    >,
  ) {}

  enterInitialPhase(
    _runtime: DeclarativeState<TState>,
    context: GameContext<TState>,
  ): void {
    context.enterCurrentPhase();
  }

  stabilize(
    runtime: DeclarativeState<TState>,
    context: GameContext<TState>,
  ): void {
    const trace: string[] = [];
    for (let iteration = 0; iteration < 32; iteration += 1) {
      if (context.effects.continue()) {
        trace.push('effects');
        continue;
      }
      if (this.finishIfVictorious(runtime, context)) return;
      const automaticRuleId = this.applyAutomaticRule(runtime, context);
      if (automaticRuleId) {
        trace.push(`automatic:${automaticRuleId}`);
        continue;
      }
      const transitionedPhase = this.transitionAutomaticPhase(runtime, context);
      if (transitionedPhase) {
        trace.push(`phase:${transitionedPhase}`);
        continue;
      }
      return;
    }
    throw new GameStateViolationError(
      `Boucle automatique non convergente: ${this.definition.id}`,
      { gameId: this.definition.id, phase: runtime.phase, trace },
    );
  }

  private finishIfVictorious(
    runtime: DeclarativeState<TState>,
    context: GameContext<TState>,
  ): boolean {
    if (!this.definition.victory) return false;
    const result = this.definition.victory.evaluate({
      state: runtime.game,
      ctx: context,
    });
    if (!result) return false;
    runtime.extras = { ...(runtime.extras ?? {}), victory: result };
    context.match.finish({
      winners: result.winnerPlayerIds,
      reason: result.reason ?? 'victory-rule',
      ranking: result.ranking,
    });
    return true;
  }

  private applyAutomaticRule(
    runtime: DeclarativeState<TState>,
    context: GameContext<TState>,
  ): string | null {
    const rule = (this.definition.automatic ?? [])
      .map((candidate, declarationIndex) => ({
        candidate,
        declarationIndex,
      }))
      .sort(
        (left, right) =>
          (right.candidate.priority ?? 0) - (left.candidate.priority ?? 0) ||
          left.declarationIndex - right.declarationIndex,
      )
      .map(({ candidate }) => candidate)
      .find((candidate) =>
        candidate.when({ state: runtime.game, ctx: context }),
      );
    if (!rule) return null;
    rule.apply({ state: runtime.game, ctx: context });
    context.events.engine('game.automatic', {
      ruleId: rule.id,
      priority: rule.priority ?? 0,
    });
    return rule.id;
  }

  private transitionAutomaticPhase(
    runtime: DeclarativeState<TState>,
    context: GameContext<TState>,
  ): string | null {
    const phase = this.definition.phases?.[runtime.phase];
    if (
      !phase?.next ||
      !phase.autoTransition?.({ state: runtime.game, ctx: context })
    ) {
      return null;
    }
    context.transitionTo(phase.next);
    return phase.next;
  }
}
