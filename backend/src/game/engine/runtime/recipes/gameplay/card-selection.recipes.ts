import type {
  CardSelectionOwner,
  CardSelectionProgram,
} from '../../effect-packs/choice-card-occurrences/program';
import type { CardValue } from '../../cards/cards-contracts';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';
import { sameSerializableValue } from '../../state/serializable-value';
import { isRecord } from '../../content/content-guards';

type State = Record<string, never>;
type Context = GameContext<State>;
type Continuation = {
  requesterId?: number;
  cards: CardValue[];
  sourcePlayerId: number;
  destinationPlayerId: number;
};

/** Selection options identify physical occurrences, so duplicate card IDs remain selectable. */
export function cardSelectionRules(source: CardSelectionProgram) {
  const program = structuredClone(source);
  return {
    action: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      available: ({ actor, ctx }) => {
        const sourcePlayer = owner(
          program.source.kind === 'hand' ? program.source.owner : undefined,
          actor.id,
          ctx,
        );
        const count = eligibleCards(program, sourcePlayer, ctx).length;
        return (
          count <= 1000 &&
          (program.shortfall === 'available' || count >= program.min)
        );
      },
      execute: ({ actor, ctx }) => request(program, actor.id, ctx),
    }),
    choice: defineChoice<State, number[]>({
      input: gameInput.array(gameInput.number({ integer: true, min: 0 }), {
        min: 0,
        max: 1000,
      }),
      resolve: ({ actor, value, ctx }) =>
        resolve(program, actor.id, value, ctx),
    }),
  };
}
function owner(
  selector: CardSelectionOwner | undefined,
  actorId: number,
  ctx: Context,
): number {
  const playerId =
    selector === 'next'
      ? ctx.players.after(actorId)?.id
      : selector === 'previous'
        ? ctx.players.before(actorId)?.id
        : actorId;
  if (playerId == null)
    throw new GameRuleViolationError('CARD_SELECTION_OWNER_MISSING');
  return playerId;
}

function sourceCards(
  program: CardSelectionProgram,
  playerId: number,
  ctx: Context,
): CardValue[] {
  if (program.source.kind === 'hand')
    return ctx.cards.hand(program.source.handId, playerId);
  if (program.source.kind === 'discard')
    return ctx.cards.discardPile(program.source.deckId);
  return ctx.cards.deckCards(program.source.deckId);
}

function identity(card: CardValue): string | number | null {
  if (typeof card === 'string' || typeof card === 'number') return card;
  if (
    'id' in card &&
    (typeof card.id === 'string' || typeof card.id === 'number')
  )
    return card.id;
  return null;
}

function eligibleCards(
  program: CardSelectionProgram,
  playerId: number,
  ctx: Context,
): CardValue[] {
  return sourceCards(program, playerId, ctx).filter((card) => {
    const id = identity(card);
    return (
      id !== null &&
      (!program.filter?.includeIds || program.filter.includeIds.includes(id)) &&
      !program.filter?.excludeIds?.includes(id) &&
      Object.entries(program.filter?.attributes ?? {}).every(
        ([key, value]) =>
          isRecord(card) &&
          isRecord(card.attributes) &&
          Object.hasOwn(card.attributes, key) &&
          card.attributes[key] === value,
      )
    );
  });
}

function request(
  program: CardSelectionProgram,
  actorId: number,
  ctx: Context,
): void {
  const sourcePlayerId = owner(
    program.source.kind === 'hand' ? program.source.owner : undefined,
    actorId,
    ctx,
  );
  const destinationPlayerId = owner(
    program.destination.kind === 'hand' ? program.destination.owner : undefined,
    actorId,
    ctx,
  );
  const cards = eligibleCards(program, sourcePlayerId, ctx);
  if (
    cards.length > 1000 ||
    (cards.length < program.min && program.shortfall === 'reject')
  )
    throw new GameRuleViolationError('CARD_SELECTION_CARDINALITY');
  ctx.choice.many({
    id: program.choiceId,
    player: owner(program.chooser, actorId, ctx),
    options: cards.map((_card, index) => index),
    min: Math.min(program.min, cards.length),
    max: Math.min(program.max, cards.length),
    timeout: program.timeout,
    label: (index) => cardLabel(cards[index]),
    data: {
      cards,
      ...(program.chooser ? { requesterId: actorId } : {}),
      sourcePlayerId,
      destinationPlayerId,
    } satisfies Continuation,
  });
}

function cardLabel(card: CardValue): string {
  if (isRecord(card))
    for (const key of ['label', 'name', 'text'] as const)
      if (key in card && typeof card[key] === 'string') return card[key];
  return String(identity(card));
}

function resolve(
  program: CardSelectionProgram,
  actorId: number,
  indexes: number[],
  ctx: Context,
): void {
  const saved = ctx.choice.consumeContinuation<Continuation>();
  if (
    !saved ||
    !Array.isArray(saved.cards) ||
    new Set(indexes).size !== indexes.length ||
    indexes.some((index) => index < 0 || index >= saved.cards.length)
  )
    throw new GameRuleViolationError('CARD_SELECTION_CONTINUATION_INVALID');
  // Old pending selections without an explicit chooser used the acting player.
  const requesterId = saved.requesterId ?? (!program.chooser ? actorId : null);
  if (
    requesterId === null ||
    !Number.isSafeInteger(requesterId) ||
    !ctx.players.get(requesterId) ||
    owner(program.chooser, requesterId, ctx) !== actorId
  )
    throw new GameRuleViolationError('CARD_SELECTION_CONTINUATION_INVALID');
  if (
    saved.sourcePlayerId !==
      owner(
        program.source.kind === 'hand' ? program.source.owner : undefined,
        requesterId,
        ctx,
      ) ||
    saved.destinationPlayerId !==
      owner(
        program.destination.kind === 'hand'
          ? program.destination.owner
          : undefined,
        requesterId,
        ctx,
      ) ||
    indexes.length < Math.min(program.min, saved.cards.length) ||
    indexes.length > program.max
  )
    throw new GameRuleViolationError('CARD_SELECTION_CONTINUATION_INVALID');
  const selected = indexes.map((index) => saved.cards[index]);
  const eligible = eligibleCards(program, saved.sourcePlayerId, ctx);
  if (!sameSerializableValue(eligible, saved.cards))
    throw new GameRuleViolationError('CARD_SELECTION_STALE');
  if (program.shortfall === 'reject' && selected.length < program.min)
    throw new GameRuleViolationError('CARD_SELECTION_CARDINALITY');
  // Exact candidate comparison and unique indexes validate multiplicity before mutations.
  for (const card of selected) {
    const taken =
      program.source.kind === 'hand'
        ? ctx.cards.take(program.source.handId, saved.sourcePlayerId, card)
        : program.source.kind === 'discard'
          ? ctx.cards.takeDiscard(program.source.deckId, card)
          : ctx.cards.takeFromDeck(program.source.deckId, card);
    if (program.destination.kind === 'hand')
      ctx.cards.give(
        program.destination.handId,
        saved.destinationPlayerId,
        taken,
      );
    else ctx.cards.discard(program.source.deckId, taken);
  }
  ctx.effects.run(
    ...(program.effects ?? []),
    ...(program.completeTurn ? [{ kind: 'complete-turn' } as const] : []),
  );
}
