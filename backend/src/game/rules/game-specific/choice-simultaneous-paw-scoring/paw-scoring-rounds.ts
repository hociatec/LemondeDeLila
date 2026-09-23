import type { GameContext } from '../../../engine/sdk/public-api';
import type { PawScoringProgram } from './program';

type State = Record<string, never>;
type Context = GameContext<State>;

export function resetPawScoringRound(program: PawScoringProgram, ctx: Context) {
  for (const player of ctx.players.all()) {
    const hand = [...ctx.cards.hand<string>(program.handId, player.id)];
    for (const cardId of hand)
      ctx.cards.take(program.handId, player.id, cardId);
    ctx.cards.putOnTop(program.deckId, hand);
  }
  const discarded = ctx.cards.discardPile<string>(program.deckId);
  for (const cardId of discarded) ctx.cards.takeDiscard(program.deckId, cardId);
  ctx.cards.putOnTop(program.deckId, discarded);
  ctx.cards.shuffle(program.deckId);
  for (const player of ctx.players.all()) {
    ctx.movement.moveTo(program.trackId, player.id, 0);
    for (const limit of program.mechanics.moveLimits)
      ctx.resources.set(player.id, program.statusPrefix + limit.resource, 0);
    for (const entry of ctx.status.list(player.id))
      if (entry.id.startsWith(program.statusPrefix))
        ctx.status.remove(player.id, entry.id);
  }
  ctx.cards.deal(
    program.deckId,
    program.handId,
    ctx.players.all().map((player) => player.id),
    program.initialHandSize,
  );
  ctx.turn.flags.clear();
  const starterId = ctx.round.starter();
  if (starterId != null) ctx.turn.to(starterId);
}
export function scorePawScoringRound(program: PawScoringProgram, ctx: Context) {
  for (const player of ctx.players.all())
    ctx.score.add(player.id, ctx.movement.position(program.trackId, player.id));
  const winnerId = ctx.round.winners()[0];
  if (winnerId != null)
    ctx.events.message('game.round.won', {
      playerId: winnerId,
      round: ctx.round.number,
    });
  if (ctx.round.completed() >= (ctx.config.get<number>('roundsToPlay') ?? 1)) {
    const matchWinnerId = ctx.ranking.rank(
      ctx.players.all().map((player) => player.id),
      { value: (id) => ctx.score.get(id), direction: 'desc' },
    )[0]?.playerId;
    if (matchWinnerId != null)
      ctx.match.finish({
        winners: [matchWinnerId],
        reason: program.mechanics.finishReason,
      });
  }
}
