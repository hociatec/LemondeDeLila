import { defineAction, gameInput } from '../../../core/application/public-api';
import type { AbsurdissimesState } from './state';

const HAND = 'answers';
const BLACK_DECK = 'black';
const WHITE_DECK = 'white';

export const playCard = defineAction<AbsurdissimesState, { cardId: string }>({
  input: gameInput.object({ cardId: gameInput.cardId() }),
  available: ({ state, actor }) =>
    state.roundStage === 'play' && state.remainingPlayers.includes(actor.id),
  availableInputs: ({ actor, ctx }) =>
    ctx.cards.hand<string>(HAND, actor.id).map((cardId) => ({ cardId })),
  execute: ({ state, actor, input, ctx }) => {
    ctx.cards.play(HAND, BLACK_DECK, actor.id, input.cardId);
    state.submissions[actor.id] = input.cardId;
    const replacement = ctx.cards.draw<string>(BLACK_DECK);
    if (replacement) ctx.cards.give(HAND, actor.id, replacement);
    state.remainingPlayers = state.remainingPlayers.filter(
      (playerId) => playerId !== actor.id,
    );
    ctx.history.add(`${actor.username} a proposé une réponse.`);
    if (state.remainingPlayers.length === 0) {
      state.roundStage = 'judge';
      ctx.turn.to(
        judgeId(
          state,
          ctx.players.all().map((player) => player.id),
        ),
      );
      ctx.events.emit('absurdissimes.submissions.revealed', {
        count: Object.keys(state.submissions).length,
      });
    } else {
      ctx.turn.to(state.remainingPlayers[0]);
    }
  },
});

export const judgePick = defineAction<AbsurdissimesState, { winnerId: number }>(
  {
    input: gameInput.object({ winnerId: gameInput.playerId() }),
    available: ({ state, actor, ctx }) =>
      state.roundStage === 'judge' &&
      actor.id ===
        judgeId(
          state,
          ctx.players.all().map((player) => player.id),
        ),
    availableInputs: ({ state }) =>
      Object.keys(state.submissions).map((playerId) => ({
        winnerId: Number(playerId),
      })),
    execute: ({ state, input, ctx }) => {
      state.scores[input.winnerId] = (state.scores[input.winnerId] ?? 0) + 1;
      const winner = ctx.players.get(input.winnerId);
      ctx.history.add(
        `${winner?.username ?? `Joueur ${input.winnerId}`} remporte la manche.`,
      );
      if (state.scores[input.winnerId] >= state.targetScore) {
        state.winnerId = input.winnerId;
        return;
      }
      prepareNextRound(state, ctx);
    },
  },
);

export const ABSURDISSIMES_ACTIONS = {
  play_card: playCard,
  judge_pick: judgePick,
};

export function judgeId(
  state: AbsurdissimesState,
  playerIds: readonly number[],
): number {
  return playerIds[state.judgeIndex % playerIds.length] ?? playerIds[0] ?? 0;
}

export function prepareNextRound(
  state: AbsurdissimesState,
  ctx: {
    cards: { draw<T>(deckId: string): T | null };
    players: { all(): Array<{ id: number }> };
    turn: { to(playerId: number): void };
  },
): void {
  const playerIds = ctx.players.all().map((player) => player.id);
  state.judgeIndex = (state.judgeIndex + 1) % playerIds.length;
  state.currentWhite = ctx.cards.draw<string>(WHITE_DECK);
  state.roundStage = 'play';
  state.submissions = {};
  const nextJudge = judgeId(state, playerIds);
  state.remainingPlayers = playerIds.filter(
    (playerId) => playerId !== nextJudge,
  );
  ctx.turn.to(state.remainingPlayers[0] ?? nextJudge);
}
