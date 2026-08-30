import {
  completeRound,
  type GameContext,
  type NoGameState,
} from '../../../engine/sdk/public-api';

type CatPattesState = NoGameState;
type RuleContext = GameContext<CatPattesState>;
const DECK = 'cat-pattes';
const HANDS = 'players';
const TRACK = 'cat-pattes';
const CAT_STATUS_PREFIX = 'cat-pattes.';
export const CAT_TURBO_PLAYED = `${CAT_STATUS_PREFIX}turbo-played`;

export function completeCatPattesRound(
  roundWinnerId: number,
  ctx: RuleContext,
): void {
  completeRound(ctx, {
    winnerPlayerIds: [roundWinnerId],
    next: { starterPlayerId: roundWinnerId },
  });
}

export function resetCatPattesRound(
  _state: CatPattesState,
  ctx: RuleContext,
): void {
  for (const player of ctx.players.all()) {
    const hand = [...ctx.cards.hand<string>(HANDS, player.id)];
    for (const cardId of hand) ctx.cards.take(HANDS, player.id, cardId);
    ctx.cards.putOnTop(DECK, hand);
  }
  const discarded = ctx.cards.discardPile<string>(DECK);
  for (const cardId of discarded) ctx.cards.takeDiscard(DECK, cardId);
  ctx.cards.putOnTop(DECK, discarded);
  ctx.cards.shuffle(DECK);
  for (const player of ctx.players.all()) {
    ctx.movement.moveTo(TRACK, player.id, 0);
    ctx.resources.set(player.id, CAT_TURBO_PLAYED, 0);
    for (const status of ctx.status.list(player.id)) {
      if (status.id.startsWith(CAT_STATUS_PREFIX)) {
        ctx.status.remove(player.id, status.id);
      }
    }
  }
  ctx.cards.deal(
    DECK,
    HANDS,
    ctx.players.all().map((player) => player.id),
    6,
  );
  ctx.turn.flags.clear();
  const starterId = ctx.round.starter();
  if (starterId != null) ctx.turn.to(starterId);
}

export function scoreCatPattesRound(
  _state: CatPattesState,
  ctx: RuleContext,
): void {
  for (const player of ctx.players.all()) {
    ctx.score.add(player.id, ctx.movement.position(TRACK, player.id));
  }
  const roundWinnerId = ctx.round.winners()[0];
  if (roundWinnerId != null) {
    ctx.events.message('game.round.won', {
      playerId: roundWinnerId,
      round: ctx.round.number,
    });
  }
  if (ctx.round.completed() >= (ctx.config.get<number>('roundsToPlay') ?? 1)) {
    const winnerId = [...ctx.players.all()].sort(
      (left, right) =>
        ctx.score.get(right.id) - ctx.score.get(left.id) || left.id - right.id,
    )[0]?.id;
    if (winnerId != null) {
      ctx.match.finish({ winners: [winnerId], reason: 'most-pattes' });
    }
  }
}
