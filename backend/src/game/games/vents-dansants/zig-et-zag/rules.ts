import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { ZIG_ET_ZAG_CARD_BY_ID, ZIG_ET_ZAG_TOTAL_CARDS } from './content';
import type { ZigEtZagState, ZigEtZagRound, ZigEtZagPlay } from './state';

const HANDS = 'players';
type RuleContext = GameRuleContext<ZigEtZagState>;

export const drawCard = defineAction<ZigEtZagState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Retourne une carte de la pile privée pour la manche en cours.',
  available: ({ state, actor }) => state.round.waitingPlayers[0] === actor.id,
  execute: ({ state, actor, ctx }) => {
    if (state.round.waitingPlayers[0] !== actor.id) {
      throw new Error('Ce joueur ne doit pas encore retourner de carte');
    }
    const hand = ctx.cards.hand<string>(HANDS, actor.id);
    const cardId = ctx.random.pick(hand);
    if (!cardId) throw new Error('Pile Zig et Zag vide');
    ctx.cards.take(HANDS, actor.id, cardId);
    recordPlay(state.round, actor.id, cardId);
    state.round.waitingPlayers.shift();
    if (state.round.waitingPlayers.length > 0) {
      ctx.turn.to(state.round.waitingPlayers[0]);
      return;
    }
    finalizeStage(state, ctx);
  },
});

export const ZIG_ET_ZAG_ACTIONS = { draw_card: drawCard };

function finalizeStage(state: ZigEtZagState, ctx: RuleContext): void {
  if (state.round.stage === 'selection') finishSelection(state, ctx);
  else if (state.round.stage === 'battle-face-down') promoteFaceUp(state, ctx);
  else resolveBattle(state, ctx);
}

function finishSelection(state: ZigEtZagState, ctx: RuleContext): void {
  const round = state.round;
  if (
    round.plays.some(
      (play) =>
        play.faceUpCard &&
        ZIG_ET_ZAG_CARD_BY_ID[play.faceUpCard]?.type === 'joker',
    )
  ) {
    finishRound(state, null, ctx);
    return;
  }
  const winners = highestPlayers(round.plays);
  if (winners.length <= 1) {
    finishRound(state, winners[0] ?? null, ctx);
    return;
  }
  const waiting = winners.filter(
    (playerId) => ctx.cards.hand<string>(HANDS, playerId).length > 0,
  );
  setTriggers(round, winners);
  round.stage = 'battle-face-down';
  round.tiedPlayers = waiting;
  round.waitingPlayers = [...waiting];
  round.battleLog.push('Bataille déclenchée !');
  if (waiting.length < 2) finishRound(state, waiting[0] ?? winners[0], ctx);
  else ctx.turn.to(waiting[0]);
}

function promoteFaceUp(state: ZigEtZagState, ctx: RuleContext): void {
  const waiting = state.round.tiedPlayers.filter(
    (playerId) => ctx.cards.hand<string>(HANDS, playerId).length > 0,
  );
  if (waiting.length < 2) {
    finishRound(state, waiting[0] ?? state.round.tiedPlayers[0] ?? null, ctx);
    return;
  }
  state.round.stage = 'battle-face-up';
  state.round.tiedPlayers = waiting;
  state.round.waitingPlayers = [...waiting];
  ctx.turn.to(waiting[0]);
}

function resolveBattle(state: ZigEtZagState, ctx: RuleContext): void {
  const eligible = state.round.plays.filter(
    (play) =>
      state.round.tiedPlayers.includes(play.playerId) &&
      play.faceUpCard != null &&
      !play.invalidJoker &&
      !play.lostByNoCard,
  );
  const winners = highestPlayers(eligible);
  if (winners.length <= 1) {
    finishRound(state, winners[0] ?? null, ctx);
    return;
  }
  setTriggers(state.round, winners);
  const waiting = winners.filter(
    (playerId) => ctx.cards.hand<string>(HANDS, playerId).length > 0,
  );
  if (waiting.length < 2) {
    finishRound(state, waiting[0] ?? winners[0] ?? null, ctx);
    return;
  }
  state.round.stage = 'battle-face-down';
  state.round.tiedPlayers = waiting;
  state.round.waitingPlayers = [...waiting];
  state.round.battleLog.push('Égalité persistante, la bataille continue !');
  ctx.turn.to(waiting[0]);
}

function finishRound(
  state: ZigEtZagState,
  winnerId: number | null,
  ctx: RuleContext,
): void {
  const tableCards = state.round.plays.flatMap((play) => play.playedCards);
  if (winnerId == null) {
    for (const cardId of tableCards) ctx.cards.discard('battle', cardId);
  } else {
    for (const cardId of tableCards) ctx.cards.give(HANDS, winnerId, cardId);
    captureBonus(state.round, winnerId, ctx);
  }
  state.lastRound = {
    winnerId,
    cardsWon: tableCards.length,
    plays: structuredClone(state.round.plays),
    battleLog: [...state.round.battleLog],
  };
  const alive = ctx.players
    .all()
    .filter((player) => ctx.cards.hand<string>(HANDS, player.id).length > 0);
  const owner = alive.find(
    (player) =>
      ctx.cards.hand<string>(HANDS, player.id).length ===
      ZIG_ET_ZAG_TOTAL_CARDS,
  );
  if (alive.length === 1 || owner) {
    state.winnerId = owner?.id ?? alive[0]?.id ?? winnerId;
    return;
  }
  state.round = createRound(ctx);
  if (state.round.waitingPlayers.length > 0) {
    ctx.turn.to(state.round.waitingPlayers[0]);
  }
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
  if (!play) throw new Error('Participation Zig et Zag introuvable');
  play.playedCards.push(cardId);
  if (round.stage === 'battle-face-down') play.faceDownCard = cardId;
  else {
    play.faceUpCard = cardId;
    play.invalidJoker =
      round.stage === 'battle-face-up' && !isAllowedJoker(round, play, cardId);
  }
}

function isAllowedJoker(
  round: ZigEtZagRound,
  play: ZigEtZagPlay,
  cardId: string,
): boolean {
  const card = ZIG_ET_ZAG_CARD_BY_ID[cardId];
  if (card?.type !== 'joker') return true;
  const family = round.triggerFamilies[play.playerId];
  return (
    card.color === round.triggerColors[play.playerId] &&
    family != null &&
    (card.allowedFamilies ?? []).includes(family)
  );
}

function highestPlayers(plays: ZigEtZagPlay[]): number[] {
  const scores = plays
    .filter(
      (play) => play.faceUpCard && !play.invalidJoker && !play.lostByNoCard,
    )
    .map((play) => ({
      playerId: play.playerId,
      value: ZIG_ET_ZAG_CARD_BY_ID[play.faceUpCard ?? '']?.value ?? -1,
    }));
  if (scores.length === 0) return [];
  const highest = Math.max(...scores.map((score) => score.value));
  return scores
    .filter((score) => score.value === highest)
    .map((score) => score.playerId);
}

function setTriggers(round: ZigEtZagRound, playerIds: number[]): void {
  for (const playerId of playerIds) {
    const cardId = round.plays.find(
      (play) => play.playerId === playerId,
    )?.faceUpCard;
    const card = cardId ? ZIG_ET_ZAG_CARD_BY_ID[cardId] : null;
    if (!card) continue;
    round.triggerColors[playerId] = card.color;
    round.triggerFamilies[playerId] = card.family;
  }
}

export function createRound(ctx: RuleContext): ZigEtZagRound {
  const waitingPlayers = ctx.players
    .all()
    .filter((player) => ctx.cards.hand<string>(HANDS, player.id).length > 0)
    .map((player) => player.id);
  return {
    stage: 'selection',
    plays: ctx.players.all().map((player) => ({
      playerId: player.id,
      playedCards: [],
      ...(waitingPlayers.includes(player.id) ? {} : { lostByNoCard: true }),
    })),
    waitingPlayers,
    tiedPlayers: [],
    triggerColors: {},
    triggerFamilies: {},
    battleLog: [],
  };
}
