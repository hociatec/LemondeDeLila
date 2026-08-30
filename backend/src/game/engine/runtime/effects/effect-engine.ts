import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import type {
  EffectEngineState,
  EffectSource,
  GameEffectInstruction,
  GameEffectResolverShape,
} from './effects-kit';
import { evaluateEffectCondition } from './effect-condition-evaluator';
import type { GameContext } from '../game-rule-context';
import { EffectTargetResolver } from './effect-target-resolver';
import {
  executeRegisteredPrimitive,
  type EffectEngineDebugSnapshot,
  type PrimitiveEffectHandlers,
} from './effect-primitive-executor';
export type { EffectEngineDebugSnapshot } from './effect-primitive-executor';
import { executeCustomEffect } from './custom-effect-executor';
import { createPrimitiveEffectHandlers } from './effect-primitive-handlers';

const MAX_EFFECTS_PER_RESOLUTION = 256;

export class GameEffectEngineController<TState extends object> {
  private draining = false;
  private readonly targetResolver: EffectTargetResolver<TState>;
  private readonly primitiveHandlers: PrimitiveEffectHandlers;

  constructor(
    private readonly state: EffectEngineState,
    private readonly gameState: () => TState,
    private readonly context: GameContext<TState>,
    private readonly resolvers: Readonly<
      Record<string, GameEffectResolverShape<TState>>
    > = {},
  ) {
    this.targetResolver = new EffectTargetResolver(state, context);
    this.primitiveHandlers = createPrimitiveEffectHandlers({
      state,
      context,
      targets: this.targetResolver,
    });
  }

  source(): EffectSource | null {
    return this.state.source ? structuredClone(this.state.source) : null;
  }

  sourcePlayerId(): number | null {
    return this.state.source?.playerId ?? null;
  }

  recordSource(source: EffectSource): void {
    this.state.source = structuredClone(source);
  }

  clearSource(): void {
    this.state.source = null;
  }

  run(...effects: readonly GameEffectInstruction[]): void {
    if (this.state.queue.length > 0 || this.state.awaitingChoiceId != null) {
      throw new GameStateViolationError(
        'Une résolution d’effets est déjà en cours',
      );
    }
    this.state.actorPlayerId =
      this.context.actor?.id ?? this.context.players.current()?.id ?? null;
    this.state.source ??= { playerId: this.state.actorPlayerId };
    this.state.chosenPlayerId = null;
    this.state.playerChoiceResolved = false;
    this.state.resolvedPlayerChoiceId = null;
    this.state.queue = [...structuredClone(effects)];
    this.drain();
  }

  schedule(...effects: readonly GameEffectInstruction[]): void {
    if (effects.length === 0) return;
    if (this.isResolving()) {
      this.state.queue.push(...structuredClone(effects));
      return;
    }
    this.run(...effects);
  }

  resumeChoice(choiceId: string, value: unknown): boolean {
    if (this.state.awaitingChoiceId !== choiceId) return false;
    if (this.state.awaitingReaction?.choiceId === choiceId) {
      const reaction = this.state.awaitingReaction;
      const selected =
        typeof value === 'string' ? reaction.reactions[value] : undefined;
      this.state.awaitingChoiceId = null;
      this.state.awaitingReaction = null;
      this.state.queue.unshift(
        ...structuredClone(selected ?? reaction.fallback),
      );
      this.drain();
      return true;
    }
    const optional = this.state.awaitingPlayerChoice?.optional === true;
    if (
      (value !== null || !optional) &&
      (typeof value !== 'number' || !this.context.players.get(value))
    ) {
      throw new GameStateViolationError('Cible d’effet invalide', {
        choiceId,
        value,
      });
    }
    this.state.awaitingChoiceId = null;
    const resolvedChoiceId = this.state.awaitingPlayerChoice?.choiceId ?? null;
    this.state.awaitingPlayerChoice = null;
    this.state.chosenPlayerId = typeof value === 'number' ? value : null;
    this.state.playerChoiceResolved = true;
    this.state.resolvedPlayerChoiceId = resolvedChoiceId;
    this.drain();
    return true;
  }

  awaitsChoice(choiceId: string): boolean {
    return this.state.awaitingChoiceId === choiceId;
  }

  continue(): boolean {
    if (
      this.draining ||
      this.state.awaitingChoiceId != null ||
      this.state.queue.length === 0 ||
      this.context.choice.current() != null
    ) {
      return false;
    }
    this.drain();
    return true;
  }

  isResolving(): boolean {
    return (
      this.draining ||
      this.state.queue.length > 0 ||
      this.state.awaitingChoiceId != null
    );
  }

  debugSnapshot(): EffectEngineDebugSnapshot {
    return {
      queueLength: this.state.queue.length,
      queueKinds: this.state.queue.map((effect) => effect.kind),
      currentSource: this.state.source
        ? structuredClone(this.state.source)
        : null,
      actorPlayerId: this.state.actorPlayerId,
      chosenPlayerId: this.state.chosenPlayerId,
      awaitingChoiceId: this.state.awaitingChoiceId,
      awaitingReactionChoiceId: this.state.awaitingReaction?.choiceId ?? null,
      awaitingPlayerChoiceId: this.state.awaitingPlayerChoice?.choiceId ?? null,
      completeTurnWhenDrained: this.state.completeTurnWhenDrained,
    };
  }

  private drain(): void {
    this.draining = true;
    try {
      for (
        let executed = 0;
        executed < MAX_EFFECTS_PER_RESOLUTION;
        executed += 1
      ) {
        const instruction = this.state.queue.shift();
        if (!instruction) {
          const completeTurn = this.state.completeTurnWhenDrained === true;
          this.reset();
          if (completeTurn) this.context.turn.complete();
          return;
        }
        if (!this.execute(instruction)) return;
        if (
          this.state.awaitingChoiceId == null &&
          this.context.choice.current() != null
        ) {
          return;
        }
      }
      throw new GameStateViolationError('Chaîne d’effets non convergente', {
        remaining: this.state.queue.length,
        source: structuredClone(this.state.source ?? null),
        actorPlayerId: this.state.actorPlayerId,
        awaitingChoiceId: this.state.awaitingChoiceId,
        queuedKinds: this.state.queue.slice(0, 12).map((effect) => effect.kind),
      });
    } finally {
      this.draining = false;
    }
  }

  private execute(instruction: GameEffectInstruction): boolean {
    if (instruction.kind === 'conditional') {
      const matched = evaluateEffectCondition(
        instruction.condition,
        (target) => this.targetResolver.targets(target, instruction),
        this.context,
      );
      if (matched == null) return false;
      this.state.queue.unshift(
        ...structuredClone(
          matched ? instruction.then : (instruction.else ?? []),
        ),
      );
      return true;
    }
    if (instruction.kind === 'reaction') {
      const reactors = this.targetResolver.targets(
        instruction.reactor,
        instruction,
      );
      if (!reactors) return false;
      const reactor = reactors[0];
      const options = this.targetResolver.availableReactionOptions(instruction);
      if (options == null) return false;
      if (reactor == null || options.length === 0) {
        this.state.queue.unshift(
          ...structuredClone(instruction.fallback ?? []),
        );
        return true;
      }
      const choiceId = instruction.choiceId ?? 'engine.effect.reaction';
      this.state.awaitingChoiceId = choiceId;
      this.state.awaitingReaction = {
        choiceId,
        reactions: Object.fromEntries(
          Object.entries(instruction.reactions).map(([option, effects]) => [
            option,
            [...structuredClone(effects)],
          ]),
        ),
        fallback: [...structuredClone(instruction.fallback ?? [])],
      };
      this.context.choice.one({
        id: choiceId,
        player: reactor,
        options,
        timeout: { afterMs: 15_000, strategy: 'first' },
      });
      return false;
    }
    if (instruction.kind === 'choose-player') {
      this.targetResolver.requestPlayerChoice(
        instruction.choiceId ?? 'engine.effect.player',
        instruction.candidates ?? 'opponents',
      );
      return false;
    }
    if (instruction.kind === 'custom') {
      return executeCustomEffect({
        instruction,
        resolvers: this.resolvers,
        gameState: this.gameState,
        engineState: this.state,
        source: this.source(),
        context: this.context,
        targets: () =>
          this.targetResolver.targets(instruction.target, instruction),
      });
    }
    return executeRegisteredPrimitive(this.primitiveHandlers, instruction);
  }

  private reset(): void {
    this.state.queue = [];
    this.state.actorPlayerId = null;
    this.state.chosenPlayerId = null;
    this.state.awaitingChoiceId = null;
    this.state.awaitingReaction = null;
    this.state.awaitingPlayerChoice = null;
    this.state.playerChoiceResolved = false;
    this.state.resolvedPlayerChoiceId = null;
    this.state.completeTurnWhenDrained = false;
  }
}
