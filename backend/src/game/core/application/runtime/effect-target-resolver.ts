import { GameStateViolationError } from '../../domain/errors/game-domain.errors';
import type {
  EffectEngineState,
  EffectTarget,
  GameEffectInstruction,
} from './effects-kit';
import type { GameContext } from './game-rule-context';
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
    for (const playerId of playerIds) apply(playerId);
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
      apply(leftPlayerId, rightPlayerId);
    }
    return true;
  }

  targets(
    target: EffectTarget | undefined,
    instruction: GameEffectInstruction,
  ): number[] | null {
    const selector = target ?? { kind: 'self' };
    const actorId = this.state.actorPlayerId;
    if (selector.kind === 'player') return [selector.playerId];
    if (selector.kind === 'self') return actorId == null ? [] : [actorId];
    if (selector.kind === 'next') {
      const next =
        actorId == null
          ? this.context.players.next()
          : this.context.players.after(actorId);
      return next ? [next.id] : [];
    }
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

  requestPlayerChoice(
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
