import {
  GameNotFoundError,
  GameStateViolationError,
} from '../../domain/errors/game-domain.errors';
import type {
  EffectEngineState,
  EffectSource,
  EffectTarget,
  GameEffectInstruction,
  GameEffectResolverShape,
} from './effects-kit';
import { evaluateEffectCondition } from './effect-condition-evaluator';
import type { GameContext } from './game-rule-context';

const MAX_EFFECTS_PER_RESOLUTION = 256;

type ControlEffectInstruction = Extract<
  GameEffectInstruction,
  { kind: 'conditional' | 'reaction' | 'choose-player' | 'custom' }
>;
type PrimitiveEffectInstruction = Exclude<
  GameEffectInstruction,
  ControlEffectInstruction
>;
type PrimitiveEffectHandlers = {
  [TKind in PrimitiveEffectInstruction['kind']]: (
    instruction: Extract<PrimitiveEffectInstruction, { kind: TKind }>,
  ) => boolean;
};

function executeRegisteredPrimitive(
  handlers: PrimitiveEffectHandlers,
  instruction: PrimitiveEffectInstruction,
): boolean {
  const handler = (
    handlers as unknown as Record<
      PrimitiveEffectInstruction['kind'],
      (value: never) => boolean
    >
  )[instruction.kind];
  return handler(instruction as never);
}

export class GameEffectEngineController<TState extends object> {
  constructor(
    private readonly state: EffectEngineState,
    private readonly gameState: () => TState,
    private readonly context: GameContext<TState>,
    private readonly resolvers: Readonly<
      Record<string, GameEffectResolverShape<TState>>
    > = {},
  ) {}

  /**
   * Registre fermé aux primitives universelles. Les orchestrations métier
   * restent des effets `custom` déclarés par chaque jeu avec `defineEffect`.
   */
  private readonly primitiveHandlers = {
    'extra-turn': (instruction) => {
      this.context.turn.extra(instruction.count ?? 1);
      return true;
    },
    'roll-dice': (instruction) => {
      this.context.dice.roll(instruction.diceId ?? 'main');
      return true;
    },
    'complete-turn': () => {
      this.state.completeTurnWhenDrained = true;
      return true;
    },
    'reverse-turn-order': () => {
      this.context.turn.reverse();
      return true;
    },
    'transfer-resource': (instruction) =>
      this.applyToPair(
        instruction,
        instruction.from,
        instruction.to,
        (fromPlayerId, toPlayerId) =>
          this.context.resources.transfer(
            fromPlayerId,
            toPlayerId,
            instruction.resource,
            instruction.amount,
          ),
      ),
    'give-card': (instruction) =>
      this.applyToPair(
        instruction,
        instruction.from,
        instruction.to,
        (fromPlayerId, toPlayerId) =>
          this.context.cards.transfer(
            instruction.handId,
            fromPlayerId,
            toPlayerId,
            instruction.cardId,
          ),
      ),
    'steal-card': (instruction) =>
      this.applyToPair(
        instruction,
        instruction.from,
        instruction.to,
        (fromPlayerId, toPlayerId) => {
          for (let count = 0; count < (instruction.count ?? 1); count += 1) {
            if (
              this.context.cards.stealRandom(
                instruction.handId,
                fromPlayerId,
                toPlayerId,
              ) == null
            ) {
              break;
            }
          }
        },
      ),
    'swap-hands': (instruction) =>
      this.applyToPair(
        instruction,
        instruction.left,
        instruction.right,
        (leftPlayerId, rightPlayerId) =>
          this.context.cards.swapHands(
            instruction.handId,
            leftPlayerId,
            rightPlayerId,
          ),
      ),
    'swap-positions': (instruction) =>
      this.applyToPair(
        instruction,
        instruction.left,
        instruction.right,
        (leftPlayerId, rightPlayerId) =>
          this.context.movement.swap(
            instruction.trackId,
            leftPlayerId,
            rightPlayerId,
          ),
      ),
    'steal-random-inventory': (instruction) =>
      this.applyToPair(
        instruction,
        instruction.from,
        instruction.to,
        (fromPlayerId, toPlayerId) => {
          for (let count = 0; count < (instruction.count ?? 1); count += 1) {
            if (
              this.context.inventory.stealRandom(
                instruction.inventoryId,
                fromPlayerId,
                toPlayerId,
              ) == null
            ) {
              break;
            }
          }
        },
      ),
    'swap-inventories': (instruction) =>
      this.applyToPair(
        instruction,
        instruction.left,
        instruction.right,
        (leftPlayerId, rightPlayerId) =>
          this.context.inventory.swap(
            instruction.inventoryId,
            leftPlayerId,
            rightPlayerId,
          ),
      ),
    'exchange-random-inventory': (instruction) =>
      this.applyToPair(
        instruction,
        instruction.left,
        instruction.right,
        (leftPlayerId, rightPlayerId) =>
          this.context.inventory.exchangeRandom(
            instruction.inventoryId,
            leftPlayerId,
            rightPlayerId,
          ),
      ),
    move: (instruction) =>
      this.applyToTargets(instruction, (playerId) =>
        this.context.movement.move(
          instruction.trackId,
          playerId,
          instruction.spaces,
        ),
      ),
    'move-to': (instruction) =>
      this.applyToTargets(instruction, (playerId) =>
        this.context.movement.moveTo(
          instruction.trackId,
          playerId,
          instruction.position,
        ),
      ),
    'draw-cards': (instruction) =>
      this.applyToTargets(instruction, (playerId) => {
        for (let count = 0; count < instruction.count; count += 1) {
          const card = instruction.recycle
            ? this.context.cards.drawOrRecycle(instruction.deckId)
            : this.context.cards.draw(instruction.deckId);
          if (card == null) break;
          this.context.cards.give(instruction.handId, playerId, card);
        }
      }),
    'discard-random': (instruction) =>
      this.applyToTargets(instruction, (playerId) => {
        for (let count = 0; count < instruction.count; count += 1) {
          if (
            this.context.cards.discardRandom(
              instruction.handId,
              instruction.deckId,
              playerId,
            ) == null
          ) {
            break;
          }
        }
      }),
    'discard-random-inventory': (instruction) =>
      this.applyToTargets(instruction, (playerId) => {
        for (let count = 0; count < instruction.count; count += 1) {
          if (
            this.context.inventory.removeRandom(
              instruction.inventoryId,
              playerId,
            ) == null
          ) {
            break;
          }
        }
      }),
    'gain-resource': (instruction) =>
      this.applyToTargets(instruction, (playerId) =>
        this.context.resources.add(
          playerId,
          instruction.resource,
          instruction.amount,
        ),
      ),
    'lose-resource': (instruction) =>
      this.applyToTargets(instruction, (playerId) => {
        const amount = instruction.allowPartial
          ? Math.min(
              instruction.amount,
              this.context.resources.get(playerId, instruction.resource),
            )
          : instruction.amount;
        if (amount > 0) {
          this.context.resources.remove(playerId, instruction.resource, amount);
        }
      }),
    'gain-score': (instruction) =>
      this.applyToTargets(instruction, (playerId) =>
        this.context.score.add(playerId, instruction.amount),
      ),
    'skip-turn': (instruction) =>
      this.applyToTargets(instruction, (playerId) =>
        this.context.turn.skip(playerId, instruction.count ?? 1),
      ),
    'add-status': (instruction) =>
      this.applyToTargets(instruction, (playerId) => {
        const turns = instruction.stack
          ? (this.context.status.get(playerId, instruction.status)?.remaining ??
              0) + (instruction.turns ?? 1)
          : instruction.turns;
        this.context.status.add(playerId, instruction.status, {
          turns,
          scope: instruction.scope,
          data: instruction.data,
        });
      }),
    'remove-status': (instruction) =>
      this.applyToTargets(instruction, (playerId) =>
        this.context.status.remove(playerId, instruction.status),
      ),
  } satisfies PrimitiveEffectHandlers;

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

  isResolving(): boolean {
    return this.state.queue.length > 0 || this.state.awaitingChoiceId != null;
  }

  private drain(): void {
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
    }
    throw new GameStateViolationError('Chaîne d’effets non convergente', {
      remaining: this.state.queue.length,
    });
  }

  private execute(instruction: GameEffectInstruction): boolean {
    if (instruction.kind === 'conditional') {
      const matched = evaluateEffectCondition(
        instruction.condition,
        (target) => this.targets(target, instruction),
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
      const reactors = this.targets(instruction.reactor, instruction);
      if (!reactors) return false;
      const reactor = reactors[0];
      const options = this.availableReactionOptions(instruction);
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
      this.requestPlayerChoice(
        instruction.choiceId ?? 'engine.effect.player',
        instruction.candidates ?? 'opponents',
      );
      return false;
    }
    if (instruction.kind === 'custom') {
      return this.executeCustom(instruction);
    }
    return executeRegisteredPrimitive(this.primitiveHandlers, instruction);
  }

  private applyToTargets(
    instruction: PrimitiveEffectInstruction & { target?: EffectTarget },
    apply: (playerId: number) => void,
  ): boolean {
    const playerIds = this.targets(instruction.target, instruction);
    if (!playerIds) return false;
    for (const playerId of playerIds) apply(playerId);
    return true;
  }

  private applyToPair(
    instruction: PrimitiveEffectInstruction,
    leftTarget: EffectTarget,
    rightTarget: EffectTarget | undefined,
    apply: (leftPlayerId: number, rightPlayerId: number) => void,
  ): boolean {
    const leftPlayerIds = this.targets(leftTarget, instruction);
    if (!leftPlayerIds) return false;
    const rightPlayerIds = this.targets(rightTarget, instruction);
    if (!rightPlayerIds) return false;
    const leftPlayerId = leftPlayerIds[0];
    const rightPlayerId = rightPlayerIds[0];
    if (leftPlayerId != null && rightPlayerId != null) {
      apply(leftPlayerId, rightPlayerId);
    }
    return true;
  }

  private executeCustom(
    instruction: Extract<GameEffectInstruction, { kind: 'custom' }>,
  ): boolean {
    const resolver = this.resolvers[instruction.effectId];
    if (!resolver) {
      throw new GameNotFoundError(
        `Effet de jeu inconnu: ${instruction.effectId}`,
      );
    }
    const data = resolver.input.parse(
      instruction.data ?? {},
      `effect.${instruction.effectId}`,
    );
    const targetPlayerIds = instruction.target
      ? this.targets(instruction.target, instruction)
      : [];
    if (!targetPlayerIds) return false;
    resolver.apply({
      state: this.gameState(),
      actorPlayerId: this.state.actorPlayerId,
      source: this.source(),
      targetPlayerIds,
      data,
      ctx: this.context,
    });
    this.context.events.engine('game.effect.resolved', {
      effectId: instruction.effectId,
    });
    return true;
  }

  private targets(
    target: EffectTarget | undefined,
    instruction: GameEffectInstruction,
  ): number[] | null {
    const selector = target ?? { kind: 'self' };
    const actorId = this.state.actorPlayerId;
    if (selector.kind === 'player') return [selector.playerId];
    if (selector.kind === 'self') return actorId == null ? [] : [actorId];
    if (selector.kind === 'next') {
      const next = this.context.players.next();
      return next ? [next.id] : [];
    }
    const opponents = this.context.players
      .active()
      .filter((player) => player.id !== actorId)
      .map((player) => player.id);
    if (selector.kind === 'all-opponents') return opponents;
    if (selector.kind === 'random-opponent') {
      const selected = this.context.random.pick(opponents);
      return selected == null ? [] : [selected];
    }
    const choiceId = selector.choiceId ?? 'engine.effect.player';
    if (
      this.state.playerChoiceResolved &&
      this.state.resolvedPlayerChoiceId === choiceId
    ) {
      return this.state.chosenPlayerId == null
        ? []
        : [this.state.chosenPlayerId];
    }
    this.state.queue.unshift(structuredClone(instruction));
    this.requestPlayerChoice(
      choiceId,
      selector.kind === 'chosen-player' ? 'active-players' : 'opponents',
      selector.optional === true,
      selector.kind === 'chosen-player' ? selector.playerIds : undefined,
      selector.chooserPlayerId,
    );
    return null;
  }

  private requestPlayerChoice(
    choiceId: string,
    candidates: 'opponents' | 'active-players',
    optional = false,
    candidatePlayerIds?: readonly number[],
    chooserPlayerId?: number,
  ): void {
    const actorId = chooserPlayerId ?? this.state.actorPlayerId;
    const allowed = candidatePlayerIds && new Set(candidatePlayerIds);
    const options = this.context.players
      .active()
      .filter(
        (player) =>
          (candidates === 'active-players' || player.id !== actorId) &&
          (!allowed || allowed.has(player.id)),
      )
      .map((player) => player.id);
    if (actorId == null || (!optional && options.length === 0)) {
      throw new GameStateViolationError(
        'Aucune cible disponible pour cet effet',
        { choiceId, actorId },
      );
    }
    this.state.chosenPlayerId = null;
    this.state.playerChoiceResolved = false;
    this.state.resolvedPlayerChoiceId = null;
    this.state.awaitingChoiceId = choiceId;
    this.state.awaitingPlayerChoice = { choiceId, optional };
    const label = (playerId: number | null) =>
      playerId == null
        ? 'Aucune cible'
        : (this.context.players.get(playerId)?.username ??
          `Joueur ${playerId}`);
    if (optional) {
      this.context.choice.one({
        id: choiceId,
        player: actorId,
        options: [...options, null],
        timeout: { afterMs: 30_000, strategy: 'last' },
        label,
      });
    } else {
      this.context.choice.player({
        id: choiceId,
        player: actorId,
        options,
        timeout: { afterMs: 30_000, strategy: 'random' },
        label,
      });
    }
  }

  private availableReactionOptions(
    instruction: Extract<GameEffectInstruction, { kind: 'reaction' }>,
  ): string[] | null {
    const availability = instruction.availability;
    if (!availability) return [...instruction.options];
    const owners = this.targets(availability.owner, instruction);
    if (!owners) return null;
    const ownerId = owners[0];
    if (ownerId == null) return [];
    if (availability.kind === 'cards') {
      const cards = new Set(
        this.context.cards.hand<string>(availability.handId, ownerId),
      );
      return instruction.options.filter((option) => cards.has(option));
    }
    const amount = availability.amount ?? 1;
    return instruction.options.filter((resource) =>
      this.context.resources.has(ownerId, resource, amount),
    );
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
