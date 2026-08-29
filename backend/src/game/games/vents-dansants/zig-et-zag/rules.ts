import {
  completeRound,
  rejectRule,
  defineAction,
  defineGamePhases,
  gameInput,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import { ZIG_ET_ZAG_CARD_BY_ID, ZIG_ET_ZAG_TOTAL_CARDS } from './content';
import type {
  ZigEtZagPlay,
  ZigEtZagPlayState,
  ZigEtZagRound,
  ZigEtZagState,
} from './state';

const HANDS = 'players';
type RuleContext = GameContext<ZigEtZagState>;
export const ZIG_ET_ZAG_PHASES = defineGamePhases<ZigEtZagState>()({
  initialPhase: 'selection',
  phases: {
    selection: {},
    'battle-face-down': {},
    'battle-face-up': {},
  },
});

export const drawCard = defineAction<ZigEtZagState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Retourne une carte de la pile privée pour la manche en cours.',
  available: ({ state, actor, ctx }) =>
    zigWaitingPlayers(state.battle, ctx)[0] === actor.id,
  execute: ({ state, actor, ctx }) => {
    if (zigWaitingPlayers(state.battle, ctx)[0] !== actor.id) {
      rejectRule('Ce joueur ne doit pas encore retourner de carte');
    }
    const hand = ctx.cards.hand<string>(HANDS, actor.id);
    const cardId = ctx.random.pick(hand);
    if (!cardId) rejectRule('Pile Zig et Zag vide');
    ctx.cards.take(HANDS, actor.id, cardId);
    recordPlay(state.battle, actor.id, cardId);
    const waitingPlayers = zigWaitingPlayers(state.battle, ctx);
    if (waitingPlayers.length > 0) {
      ctx.turn.to(waitingPlayers[0]);
      return;
    }
    finalizeStage(state, ctx);
  },
});

export const ZIG_ET_ZAG_ACTIONS = { draw_card: drawCard };

function finalizeStage(state: ZigEtZagState, ctx: RuleContext): void {
  if (ZIG_ET_ZAG_PHASES.is(ctx, 'selection')) finishSelection(state, ctx);
  else if (ZIG_ET_ZAG_PHASES.is(ctx, 'battle-face-down'))
    promoteFaceUp(state, ctx);
  else resolveBattle(state, ctx);
}

function finishSelection(state: ZigEtZagState, ctx: RuleContext): void {
  const round = state.battle;
  if (
    round.plays.some(
      (play) =>
        ZIG_ET_ZAG_CARD_BY_ID[currentFaceUp(play) ?? '']?.type === 'joker',
    )
  ) {
    completeZigEtZagRound(state, null, ctx);
    return;
  }
  const winners = highestPlayers(round.plays);
  if (winners.length <= 1) {
    completeZigEtZagRound(state, winners[0] ?? null, ctx);
    return;
  }
  const waiting = winners.filter(
    (playerId) => ctx.cards.hand<string>(HANDS, playerId).length > 0,
  );
  round.tiedPlayers = waiting;
  ZIG_ET_ZAG_PHASES.transition(ctx, 'battle-face-down');
  ctx.events.message('zig.battle.started', {
    roundNumber: ctx.round.number,
  });
  if (waiting.length < 2)
    completeZigEtZagRound(state, waiting[0] ?? winners[0], ctx);
  else ctx.turn.to(waiting[0]);
}

function promoteFaceUp(state: ZigEtZagState, ctx: RuleContext): void {
  const waiting = state.battle.tiedPlayers.filter(
    (playerId) => ctx.cards.hand<string>(HANDS, playerId).length > 0,
  );
  if (waiting.length < 2) {
    completeZigEtZagRound(
      state,
      waiting[0] ?? state.battle.tiedPlayers[0] ?? null,
      ctx,
    );
    return;
  }
  state.battle.tiedPlayers = waiting;
  ZIG_ET_ZAG_PHASES.transition(ctx, 'battle-face-up');
  ctx.turn.to(waiting[0]);
}

function resolveBattle(state: ZigEtZagState, ctx: RuleContext): void {
  const eligible = state.battle.plays.filter(
    (play) =>
      state.battle.tiedPlayers.includes(play.playerId) &&
      currentFaceUp(play) != null &&
      !invalidJoker(play),
  );
  const winners = highestPlayers(eligible);
  if (winners.length <= 1) {
    completeZigEtZagRound(state, winners[0] ?? null, ctx);
    return;
  }
  const waiting = winners.filter(
    (playerId) => ctx.cards.hand<string>(HANDS, playerId).length > 0,
  );
  if (waiting.length < 2) {
    completeZigEtZagRound(state, waiting[0] ?? winners[0] ?? null, ctx);
    return;
  }
  state.battle.tiedPlayers = waiting;
  ZIG_ET_ZAG_PHASES.transition(ctx, 'battle-face-down');
  ctx.events.message('zig.battle.continues', {
    roundNumber: ctx.round.number,
  });
  ctx.turn.to(waiting[0]);
}

function completeZigEtZagRound(
  state: ZigEtZagState,
  winnerId: number | null,
  ctx: RuleContext,
): void {
  const tableCards = state.battle.plays.flatMap((play) => play.playedCards);
  if (winnerId == null) {
    for (const cardId of tableCards) ctx.cards.discard('battle', cardId);
  } else {
    for (const cardId of tableCards) ctx.cards.give(HANDS, winnerId, cardId);
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
    .filter((player) => ctx.cards.hand<string>(HANDS, player.id).length > 0);
  const owner = alive.find(
    (player) =>
      ctx.cards.hand<string>(HANDS, player.id).length ===
      ZIG_ET_ZAG_TOTAL_CARDS,
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
      ZIG_ET_ZAG_PHASES.transition(ctx, 'selection');
    },
    next: () => {
      const starterId = zigWaitingPlayers(state.battle, ctx)[0] ?? null;
      if (starterId != null) ctx.turn.to(starterId);
      return starterId;
    },
  });
}

function captureBonus(
  round: ZigEtZagRound,
  winnerId: number,
  ctx: RuleContext,
): void {
  const loser = ctx.players.all().find((player) => player.id !== winnerId);
  if (!loser) return;
  const count =
    round.plays.find((play) => play.playerId === winnerId)?.playedCards
      .length ?? 0;
  const loserHand = ctx.cards.hand<string>(HANDS, loser.id);
  for (let index = 0; index < count && loserHand.length > 0; index += 1) {
    const cardId = loserHand[0];
    ctx.cards.take(HANDS, loser.id, cardId);
    ctx.cards.give(HANDS, winnerId, cardId);
  }
}

function recordPlay(
  round: ZigEtZagRound,
  playerId: number,
  cardId: string,
): void {
  const play = round.plays.find((candidate) => candidate.playerId === playerId);
  if (!play) rejectRule('Participation Zig et Zag introuvable');
  play.playedCards.push(cardId);
}

function isAllowedJoker(play: ZigEtZagPlayState, cardId: string): boolean {
  const card = ZIG_ET_ZAG_CARD_BY_ID[cardId];
  if (card?.type !== 'joker') return true;
  const triggerCard =
    ZIG_ET_ZAG_CARD_BY_ID[play.playedCards[play.playedCards.length - 3] ?? ''];
  return (
    card.color === triggerCard?.color &&
    triggerCard.family != null &&
    (card.allowedFamilies ?? []).includes(triggerCard.family)
  );
}

function highestPlayers(plays: ZigEtZagPlayState[]): number[] {
  const scores = plays
    .filter((play) => currentFaceUp(play) && !invalidJoker(play))
    .map((play) => ({
      playerId: play.playerId,
      value: ZIG_ET_ZAG_CARD_BY_ID[currentFaceUp(play) ?? '']?.value ?? -1,
    }));
  if (scores.length === 0) return [];
  const highest = Math.max(...scores.map((score) => score.value));
  return scores
    .filter((score) => score.value === highest)
    .map((score) => score.playerId);
}

export function createRound(ctx: RuleContext): ZigEtZagRound {
  const waitingPlayers = ctx.players
    .all()
    .filter((player) => ctx.cards.hand<string>(HANDS, player.id).length > 0)
    .map((player) => player.id);
  return {
    plays: waitingPlayers.map((playerId) => ({ playerId, playedCards: [] })),
    tiedPlayers: [],
  };
}

export function zigWaitingPlayers(
  round: ZigEtZagRound,
  ctx: RuleContext,
): number[] {
  if (ZIG_ET_ZAG_PHASES.is(ctx, 'selection')) {
    return round.plays
      .filter((play) => play.playedCards.length === 0)
      .map((play) => play.playerId);
  }
  return round.tiedPlayers.filter((playerId) => {
    const playedCount =
      round.plays.find((play) => play.playerId === playerId)?.playedCards
        .length ?? 0;
    return ZIG_ET_ZAG_PHASES.is(ctx, 'battle-face-down')
      ? playedCount % 2 === 1
      : playedCount % 2 === 0;
  });
}

export function zigRoundPlays(round: ZigEtZagRound): ZigEtZagPlay[] {
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

function currentFaceUp(play: ZigEtZagPlayState): string | null {
  const length = play.playedCards.length;
  const index = length % 2 === 0 ? length - 2 : length - 1;
  return index >= 0 ? (play.playedCards[index] ?? null) : null;
}

function currentFaceDown(play: ZigEtZagPlayState): string | null {
  const length = play.playedCards.length;
  if (length < 2) return null;
  const index = length % 2 === 0 ? length - 1 : length - 2;
  return play.playedCards[index] ?? null;
}

function invalidJoker(play: ZigEtZagPlayState): boolean {
  const cardId = currentFaceUp(play);
  return cardId != null && play.playedCards.length >= 3
    ? !isAllowedJoker(play, cardId)
    : false;
}
