import { GameStateViolationError } from '../contracts/game-domain.errors';
import { evaluateEffectCondition } from './effect-condition-evaluator';
import type {
  EffectEngineState,
  EffectTarget,
  GameEffectInstruction,
} from '../contracts/effect-ir';
import type { GameContext } from '../definitions/game-author-context';
import type { PrimitiveEffectInstruction } from './effect-primitive-executor';

export class EffectTargetResolver<TState extends object> {
  constructor(
    private readonly state: EffectEngineState,
    private readonly context: GameContext<TState>,
  ) {}

  applyToTargets(
    instruction: PrimitiveEffectInstruction & { target?: EffectTarget },
    apply: (playerId: number) => void,
  ): boolean {
    const playerIds = this.targets(instruction.target, instruction);
    if (!playerIds) return false;
    for (const playerId of playerIds)
      if (!this.intercepted(playerId, instruction)) apply(playerId);
    return true;
  }

  applyToPair(
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
      const transfer =
        instruction.kind === 'transfer-resource' ||
        instruction.kind === 'give-card' ||
        instruction.kind === 'steal-card' ||
        instruction.kind === 'steal-random-inventory';
      if (
        this.intercepted(leftPlayerId, instruction) ||
        (!transfer && this.intercepted(rightPlayerId, instruction))
      )
        return true;
      apply(leftPlayerId, rightPlayerId);
    }
    return true;
  }

  private intercepted(
    playerId: number,
    instruction: GameEffectInstruction,
  ): boolean {
    const categories = [`effect:${instruction.kind}`];
    if (instruction.kind === 'move' || instruction.kind === 'move-to')
      categories.push('movement');
    if (instruction.kind === 'move' && instruction.spaces < 0)
      categories.push('negative-movement');
    if (
      instruction.kind === 'lose-resource' ||
      instruction.kind === 'transfer-resource'
    )
      categories.push('resource-loss');
    if (
      instruction.kind === 'discard-random' ||
      instruction.kind === 'move-card' ||
      instruction.kind === 'steal-card' ||
      instruction.kind === 'give-card'
    )
      categories.push('card-loss');
    if (
      instruction.kind === 'discard-random-inventory' ||
      instruction.kind === 'steal-random-inventory'
    )
      categories.push('inventory-loss');
    return categories.some((category) =>
      this.context.status.intercept(playerId, category),
    );
  }

  targets(
    target: EffectTarget | undefined,
    instruction: GameEffectInstruction,
  ): number[] | null {
    const selector = target ?? { kind: 'self' };
    const actorId = this.state.actorPlayerId;
    if (selector.kind === 'player') return [selector.playerId];
    if (selector.kind === 'self') return actorId == null ? [] : [actorId];
    if (selector.kind === 'current-player') {
      const current = this.context.players.current();
      return current ? [current.id] : [];
    }
    if (selector.kind === 'matching-players') {
      const players =
        selector.participants === 'all'
          ? this.context.players.all()
          : this.context.players.active();
      return players
        .filter(
          (player) =>
            evaluateEffectCondition(
              selector.condition,
              () => [player.id],
              this.context,
            ) === true,
        )
        .map((player) => player.id);
    }
    if (
      (selector.kind === 'next' || selector.kind === 'previous') &&
      selector.order === 'turn'
    )
      return this.turnTarget(selector.kind);
    if (selector.kind === 'next') {
      const next =
        actorId == null
          ? this.context.players.next()
          : this.context.players.after(actorId);
      return next ? [next.id] : [];
    }
    if (selector.kind === 'previous') {
      const previous =
        actorId == null
          ? this.context.players.previous()
          : this.context.players.before(actorId);
      return previous ? [previous.id] : [];
    }
    if (selector.kind === 'random-player') {
      const selected = this.context.random.pick(
        this.context.players.active().map((player) => player.id),
      );
      return selected == null ? [] : [selected];
    }
    if (selector.kind === 'leader' || selector.kind === 'last')
      return this.rankedTargets(selector);
    if (selector.kind === 'all-players') {
      return this.context.players.all().map((player) => player.id);
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
    return this.chosenTargets(selector, instruction);
  }

  private chosenTargets(
    selector: Extract<
      EffectTarget,
      { kind: 'chosen-player' | 'chosen-opponent' }
    >,
    instruction: GameEffectInstruction,
  ): number[] | null {
    const choiceId = selector.choiceId ?? 'engine.effect.player';
    if (
      this.state.playerChoiceResolved &&
      this.state.resolvedPlayerChoiceId === choiceId
    ) {
      return this.state.chosenPlayerId == null
        ? []
        : [this.state.chosenPlayerId];
    }
    const resolvedImmediately = this.requestPlayerChoice(
      choiceId,
      selector.kind === 'chosen-player' ? 'active-players' : 'opponents',
      selector.optional === true,
      selector.kind === 'chosen-player' ? selector.playerIds : undefined,
      selector.chooserPlayerId,
    );
    if (resolvedImmediately) {
      return this.state.chosenPlayerId == null
        ? []
        : [this.state.chosenPlayerId];
    }
    this.state.queue.unshift(structuredClone(instruction));
    return null;
  }

  private rankedTargets(
    selector: Extract<EffectTarget, { kind: 'leader' | 'last' }>,
  ): number[] {
    const ranked = this.context.players.active().map((player) => ({
      id: player.id,
      score: this.context.score.get(player.id),
    }));
    if (!ranked.length) return [];
    const extreme =
      selector.kind === 'leader'
        ? Math.max(...ranked.map((player) => player.score))
        : Math.min(...ranked.map((player) => player.score));
    const tied = ranked
      .filter((player) => player.score === extreme)
      .map((player) => player.id);
    if (selector.ties === 'all') return tied;
    if (selector.ties === 'lowest-id') return [Math.min(...tied)];
    const selected = this.context.random.pick(tied);
    return selected == null ? [] : [selected];
  }

  private turnTarget(kind: 'next' | 'previous'): number[] {
    const players = this.context.players.active();
    const actorId =
      this.state.actorPlayerId ?? this.context.players.current()?.id;
    const index = players.findIndex((player) => player.id === actorId);
    if (index < 0) return [];
    const offset = this.context.turn.direction() * (kind === 'next' ? 1 : -1);
    return [players[(index + offset + players.length) % players.length].id];
  }

  requestPlayerChoice(
    choiceId: string,
    candidates: 'opponents' | 'active-players',
    optional = false,
    candidatePlayerIds?: readonly number[],
    chooserPlayerId?: number,
  ): boolean {
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
    if (
      (!optional && options.length === 1) ||
      (optional && options.length === 0)
    ) {
      this.state.chosenPlayerId = options[0] ?? null;
      this.state.playerChoiceResolved = true;
      this.state.resolvedPlayerChoiceId = choiceId;
      this.state.awaitingChoiceId = null;
      this.state.awaitingPlayerChoice = null;
      return true;
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
    return false;
  }

  availableReactionOptions(
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
}
