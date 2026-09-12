import { gameInput } from '../../actions/game-input-schema';
import type { ZigEtZagProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../definitions/game-definition-builders';
import { defineGamePhases } from '../../kits/phase-kit';
import { completeRound } from '../../recipes/gameplay/track-round.recipes';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';

type PlayState = { playerId: number; playedCards: string[] };
type RoundState = { plays: PlayState[]; tiedPlayers: number[] };
type RoundSummary = {
  roundNumber: number;
  roundWinnerPlayerId: number | null;
  cardsWon: number;
  plays: PlayState[];
};
type RuntimeState = { battle: RoundState; lastRound: RoundSummary | null };
type State = Record<string, never>;
type Context = GameContext<State>;

export function zigEtZagRules(source: ZigEtZagProgram) {
  const program = structuredClone(source);
  const cards = Object.fromEntries(
    program.cards.map((card) => [card.id, card]),
  );
  const phases = defineGamePhases<State>()({
    initialPhase: 'selection',
    phases: {
      selection: { transitions: ['battle-face-down'] },
      'battle-face-down': { transitions: ['battle-face-up', 'selection'] },
      'battle-face-up': { transitions: ['battle-face-down', 'selection'] },
    },
  });
  const draw = defineAction<State, Record<string, never>>({
    input: gameInput.object({}),
    documentation:
      'Retourne une carte de la pile privée pour la manche en cours.',
    available: ({ state, actor, ctx }) =>
      waiting(runtime(state).battle, ctx, phases)[0] === actor.id,
    execute: ({ state, actor, ctx }) => {
      const current = runtime(state);
      if (waiting(current.battle, ctx, phases)[0] !== actor.id)
        rejectRule('Ce joueur ne doit pas encore retourner de carte');
      const hand = ctx.cards.hand<string>(program.handId, actor.id);
      const cardId = ctx.random.pick(hand);
      if (!cardId) rejectRule('Pile Zig et Zag vide');
      ctx.cards.take(program.handId, actor.id, cardId);
      const play = current.battle.plays.find(
        (item) => item.playerId === actor.id,
      );
      if (!play) rejectRule('Participation Zig et Zag introuvable');
      play.playedCards.push(cardId);
      const pending = waiting(current.battle, ctx, phases);
      if (pending.length > 0) return ctx.turn.to(pending[0]);
      finalize(current, ctx);
    },
  });

  function finalize(state: RuntimeState, ctx: Context): void {
    if (phases.is(ctx, 'selection')) finishSelection(state, ctx);
    else if (phases.is(ctx, 'battle-face-down')) promoteFaceUp(state, ctx);
    else resolveBattle(state, ctx);
  }

  function finishSelection(state: RuntimeState, ctx: Context): void {
    const round = state.battle;
    if (
      round.plays.some(
        (play) => cards[currentFaceUp(play) ?? '']?.type === 'joker',
      )
    )
      return complete(state, null, ctx);
    const winners = highestPlayers(round.plays);
    if (winners.length <= 1) return complete(state, winners[0] ?? null, ctx);
    const pending = winners.filter(
      (playerId) => ctx.cards.hand<string>(program.handId, playerId).length > 0,
    );
    round.tiedPlayers = pending;
    phases.transition(ctx, 'battle-face-down');
    ctx.events.message('zig.battle.started', { roundNumber: ctx.round.number });
    if (pending.length < 2) complete(state, pending[0] ?? winners[0], ctx);
    else ctx.turn.to(pending[0]);
  }

  function promoteFaceUp(state: RuntimeState, ctx: Context): void {
    const pending = state.battle.tiedPlayers.filter(
      (playerId) => ctx.cards.hand<string>(program.handId, playerId).length > 0,
    );
    if (pending.length < 2)
      return complete(
        state,
        pending[0] ?? state.battle.tiedPlayers[0] ?? null,
        ctx,
      );
    state.battle.tiedPlayers = pending;
    phases.transition(ctx, 'battle-face-up');
    ctx.turn.to(pending[0]);
  }

  function resolveBattle(state: RuntimeState, ctx: Context): void {
    const eligible = state.battle.plays.filter(
      (play) =>
        state.battle.tiedPlayers.includes(play.playerId) &&
        currentFaceUp(play) != null &&
        !invalidJoker(play),
    );
    const winners = highestPlayers(eligible);
    if (winners.length <= 1) return complete(state, winners[0] ?? null, ctx);
    const pending = winners.filter(
      (playerId) => ctx.cards.hand<string>(program.handId, playerId).length > 0,
    );
    if (pending.length < 2)
      return complete(state, pending[0] ?? winners[0] ?? null, ctx);
    state.battle.tiedPlayers = pending;
    phases.transition(ctx, 'battle-face-down');
    ctx.events.message('zig.battle.continues', {
      roundNumber: ctx.round.number,
    });
    ctx.turn.to(pending[0]);
  }

  function complete(
    state: RuntimeState,
    winnerId: number | null,
    ctx: Context,
  ): void {
    const tableCards = state.battle.plays.flatMap((play) => play.playedCards);
    if (winnerId == null)
      for (const cardId of tableCards)
        ctx.cards.discard(program.deckId, cardId);
    else {
      for (const cardId of tableCards)
        ctx.cards.give(program.handId, winnerId, cardId);
      captureBonus(state.battle, winnerId, ctx);
    }
    state.lastRound = {
      roundNumber: ctx.round.number,
      roundWinnerPlayerId: winnerId,
      cardsWon: tableCards.length,
      plays: structuredClone(state.battle.plays),
    };
    const alive = ctx.players
      .all()
      .filter(
        (player) =>
          ctx.cards.hand<string>(program.handId, player.id).length > 0,
      );
    const owner = alive.find(
      (player) =>
        ctx.cards.hand<string>(program.handId, player.id).length ===
        program.totalCards,
    );
    completeRound(ctx, {
      winnerPlayerIds: winnerId == null ? [] : [winnerId],
      finishMatch: () => {
        if (alive.length !== 1 && !owner) return false;
        const matchWinnerId = owner?.id ?? alive[0]?.id ?? winnerId;
        ctx.match.finish({
          winners: matchWinnerId == null ? [] : [matchWinnerId],
          reason: 'all-cards-captured',
        });
        return true;
      },
      reset: () => {
        state.battle = createRound(ctx);
        phases.transition(ctx, 'selection');
      },
      next: () => {
        const starterId = waiting(state.battle, ctx, phases)[0] ?? null;
        if (starterId != null) ctx.turn.to(starterId);
        return starterId;
      },
    });
  }

  function captureBonus(
    round: RoundState,
    winnerId: number,
    ctx: Context,
  ): void {
    const loser = ctx.players.all().find((player) => player.id !== winnerId);
    if (!loser) return;
    const count =
      round.plays.find((play) => play.playerId === winnerId)?.playedCards
        .length ?? 0;
    const loserHand = ctx.cards.hand<string>(program.handId, loser.id);
    for (const cardId of loserHand.slice(0, count)) {
      ctx.cards.take(program.handId, loser.id, cardId);
      ctx.cards.give(program.handId, winnerId, cardId);
    }
  }

  function highestPlayers(plays: PlayState[]): number[] {
    const scores = plays
      .filter((play) => currentFaceUp(play) && !invalidJoker(play))
      .map((play) => ({
        playerId: play.playerId,
        value: cards[currentFaceUp(play) ?? '']?.value ?? -1,
      }));
    if (scores.length === 0) return [];
    const highest = Math.max(...scores.map((score) => score.value));
    return scores
      .filter((score) => score.value === highest)
      .map((score) => score.playerId);
  }

  function invalidJoker(play: PlayState): boolean {
    const cardId = currentFaceUp(play);
    if (cardId == null || play.playedCards.length < 3) return false;
    const card = cards[cardId];
    if (card?.type !== 'joker') return false;
    const trigger = cards[play.playedCards[play.playedCards.length - 3] ?? ''];
    return !(
      card.color === trigger?.color &&
      trigger.family != null &&
      (card.allowedFamilies ?? []).includes(trigger.family)
    );
  }

  function enrich(round: RoundState) {
    return round.plays.map((play) => {
      const faceDownCard = currentFaceDown(play);
      const faceUpCard = currentFaceUp(play);
      return {
        ...structuredClone(play),
        ...(faceDownCard == null ? {} : { faceDownCard }),
        ...(faceUpCard == null ? {} : { faceUpCard }),
        ...(invalidJoker(play) ? { invalidJoker: true } : {}),
      };
    });
  }

  return {
    draw,
    setup: ({ ctx }: { ctx: Context }): State => {
      const state: State = {};
      Reflect.set(state, 'battle', createRound(ctx));
      Reflect.set(state, 'lastRound', null);
      return state;
    },
    viewExtension: ({ state, ctx }: { state: State; ctx: Context }) => {
      const summary = runtime(state).lastRound;
      return {
        lastRound: summary
          ? {
              roundNumber: summary.roundNumber,
              roundWinnerPlayerId: summary.roundWinnerPlayerId,
              cardsWon: summary.cardsWon,
              plays: enrich({ plays: summary.plays, tiedPlayers: [] }),
              battleLog: ctx.events.messages().flatMap((entry) =>
                (entry.key === 'zig.battle.started' ||
                  entry.key === 'zig.battle.continues') &&
                entry.params.roundNumber === summary.roundNumber
                  ? [
                      {
                        key: entry.key,
                        params: { roundNumber: summary.roundNumber },
                      },
                    ]
                  : [],
              ),
            }
          : null,
      };
    },
  };

  function createRound(ctx: Context): RoundState {
    const playerIds = ctx.players
      .all()
      .filter(
        (player) =>
          ctx.cards.hand<string>(program.handId, player.id).length > 0,
      )
      .map((player) => player.id);
    return {
      plays: playerIds.map((playerId) => ({ playerId, playedCards: [] })),
      tiedPlayers: [],
    };
  }
}
function runtime(state: State): RuntimeState {
  if (!isRuntimeState(state))
    throw new TypeError('Invalid Zig et Zag runtime state');
  return state;
}

function isRuntimeState(state: State): state is State & RuntimeState {
  const battle = Reflect.get(state, 'battle');
  const lastRound = Reflect.get(state, 'lastRound');
  return (
    typeof battle === 'object' &&
    battle !== null &&
    (lastRound === null ||
      (typeof lastRound === 'object' && lastRound !== null))
  );
}

function waiting(
  round: RoundState,
  ctx: Context,
  phases: {
    is(
      ctx: Context,
      phaseId: 'selection' | 'battle-face-down' | 'battle-face-up',
    ): boolean;
  },
): number[] {
  if (phases.is(ctx, 'selection'))
    return round.plays
      .filter((play) => play.playedCards.length === 0)
      .map((play) => play.playerId);
  return round.tiedPlayers.filter((playerId) => {
    const count =
      round.plays.find((play) => play.playerId === playerId)?.playedCards
        .length ?? 0;
    return phases.is(ctx, 'battle-face-down')
      ? count % 2 === 1
      : count % 2 === 0;
  });
}

function currentFaceUp(play: PlayState): string | null {
  const length = play.playedCards.length;
  const index = length % 2 === 0 ? length - 2 : length - 1;
  return index >= 0 ? (play.playedCards[index] ?? null) : null;
}

function currentFaceDown(play: PlayState): string | null {
  const length = play.playedCards.length;
  if (length < 2) return null;
  const index = length % 2 === 0 ? length - 1 : length - 2;
  return play.playedCards[index] ?? null;
}
