import {
  completeRound,
  rejectRule,
  defineAction,
  defineGamePhases,
  gameInput,
} from '../../../engine/sdk/public-api';
import type { GameContext, NoGameState } from '../../../engine/sdk/public-api';
import {
  buildLamaDeck,
  LAMA_NUMBER_VALUES,
  LAMA_VALUE,
  lamaLabel,
  lamaPenalty,
  nextLamaValue,
  type LamaCard,
} from './content';
import type { LamaConfig } from './config';

type LamaState = NoGameState;

type RuleContext = GameContext<LamaState>;
export const LAMA_PHASES = defineGamePhases<LamaState>()({
  initialPhase: 'setup',
  phases: { setup: {}, turn: {}, return: {}, pause: {} },
});
const DECK = 'lama';
const HANDS = 'lama-hands';
const DRAWN_TURN_FLAG = 'lama.drawn';

export const play = defineAction<LamaState, { value: LamaCard }>({
  ui: { label: 'Jouer une carte', control: 'card' },
  input: gameInput.object({
    value: gameInput.union([
      gameInput.numberEnum(LAMA_NUMBER_VALUES),
      gameInput.literal(LAMA_VALUE),
    ]),
  }),
  documentation:
    'Joue une carte égale ou immédiatement supérieure à la défausse.',
  available: ({ actor, ctx }) =>
    isCurrentPlayer(actor.id, ctx) &&
    LAMA_PHASES.is(ctx, 'turn') &&
    playableValues(actor.id, ctx).length > 0,
  validate: ({ actor, input, ctx }) =>
    isCurrentPlayer(actor.id, ctx) &&
    playableValues(actor.id, ctx).includes(input.value),
  enumerate: ({ actor, ctx }) =>
    playableValues(actor.id, ctx).map((value) => ({ value })),
  execute: ({ state, actor, input, ctx }) => {
    requireCurrentPlayer(actor.id, ctx);
    const value = input.value;
    if (!playableValues(actor.id, ctx).includes(value))
      rejectRule('Carte LAMA injouable');
    ctx.cards.play(HANDS, DECK, actor.id, value);
    ctx.events.message('game.card.played', {
      playerId: actor.id,
      cardId: value,
      cardLabel: lamaLabel(value),
    });
    if (ctx.cards.hand<LamaCard>(HANDS, actor.id).length === 0)
      endRound(state, actor.id, ctx);
    else ctx.turn.end();
  },
});

export const draw = defineAction<LamaState, Record<string, never>>({
  ui: { label: 'Piocher', control: 'button', shortcut: 'Space' },
  input: gameInput.object({}),
  documentation:
    "Pioche au plus une carte pendant le tour, tant qu'aucun joueur n'est sorti de la manche.",
  available: ({ actor, ctx }) =>
    isCurrentPlayer(actor.id, ctx) &&
    LAMA_PHASES.is(ctx, 'turn') &&
    ctx.round.leftPlayers().length === 0 &&
    !ctx.turn.flags.get<boolean>(DRAWN_TURN_FLAG) &&
    ctx.cards.deckCount(DECK) > 0,
  execute: ({ actor, ctx }) => {
    requireCurrentPlayer(actor.id, ctx);
    const card = ctx.cards.draw<LamaCard>(DECK);
    if (card == null) rejectRule('Pioche LAMA vide');
    ctx.cards.give(HANDS, actor.id, card);
    ctx.events.message('game.card.drawn', {
      playerId: actor.id,
      deckId: DECK,
    });
    if (lamaConfig(ctx).allowPlayAfterDraw) ctx.turn.flags.set(DRAWN_TURN_FLAG);
    else {
      ctx.turn.end();
    }
  },
});

export const pass = defineAction<LamaState, Record<string, never>>({
  ui: { label: 'Passer', control: 'button' },
  input: gameInput.object({}),
  documentation:
    'Termine le tour après une pioche lorsque cette option est active.',
  available: ({ actor, ctx }) =>
    isCurrentPlayer(actor.id, ctx) &&
    LAMA_PHASES.is(ctx, 'turn') &&
    lamaConfig(ctx).allowPlayAfterDraw &&
    ctx.turn.flags.get<boolean>(DRAWN_TURN_FLAG) === true,
  execute: ({ actor, ctx }) => {
    requireCurrentPlayer(actor.id, ctx);
    ctx.events.message('game.player.passed', { playerId: actor.id });
    ctx.turn.end();
  },
});

export const quit = defineAction<LamaState, Record<string, never>>({
  ui: { label: 'Sortir de la manche', control: 'button', shortcut: 'P' },
  input: gameInput.object({}),
  documentation:
    'Se retire de la manche en conservant ses cartes pour le décompte.',
  available: ({ actor, ctx }) =>
    isCurrentPlayer(actor.id, ctx) &&
    LAMA_PHASES.is(ctx, 'turn') &&
    ctx.round.activePlayers().some((player) => player.id === actor.id),
  execute: ({ state, actor, ctx }) => {
    requireCurrentPlayer(actor.id, ctx);
    ctx.round.leave(actor.id);
    if (activeRoundPlayers(ctx).length === 0) endRound(state, null, ctx);
    else ctx.turn.end();
  },
});

export const LAMA_ACTIONS = {
  lama_play: play,
  draw,
  lama_pass: pass,
  lama_quit: quit,
};

export function resolveReturn(
  state: LamaState,
  value: number,
  ctx: RuleContext,
): void {
  const playerId = ctx.round.winners()[0] ?? null;
  if (!LAMA_PHASES.is(ctx, 'return') || playerId == null)
    rejectRule('Rendu de jetons LAMA absent');
  if (value !== 0 && value !== 1 && value !== 10)
    rejectRule('Rendu de jetons LAMA invalide');
  if (value > ctx.score.get(playerId)) rejectRule('Jetons LAMA insuffisants');
  ctx.score.subtract(playerId, value);
  advanceAfterLamaRound(state, ctx);
}

export function resolvePause(_state: LamaState, ctx: RuleContext): void {
  if (!LAMA_PHASES.is(ctx, 'pause')) rejectRule('Pause LAMA absente');
  completeRound(ctx, { end: false, next: 'rotate' });
}

export function skipInactiveLamaPlayer(
  _state: LamaState,
  ctx: RuleContext,
): void {
  ctx.turn.end();
}

export function startLama(_state: LamaState, ctx: RuleContext): void {
  LAMA_PHASES.transition(ctx, 'turn');
  ctx.round.start(ctx.players.active()[0]?.id);
}

export function prepareLamaRound(_state: LamaState, ctx: RuleContext): void {
  const players = ctx.players.all();
  const survivors = ctx.round.activePlayers();
  const config = lamaConfig(ctx);
  const deck = buildLamaDeck(config.copiesPerCardValue);
  ctx.cards.resetDeck(DECK, deck, { shuffle: true });
  ctx.cards.clearHands(
    HANDS,
    players.map((player) => player.id),
  );
  const starterId = ctx.round.starter() ?? survivors[0]?.id;
  ctx.events.message('game.round.started', {
    round: ctx.round.number,
    starterPlayerId: starterId,
  });
  ctx.cards.deal(
    DECK,
    HANDS,
    survivors.map((player) => player.id),
    config.startingHandSize,
  );
  const first = ctx.cards.draw<LamaCard>(DECK);
  if (first == null) rejectRule('Paquet LAMA insuffisant');
  ctx.cards.discard(DECK, first);
  ctx.turn.flags.clear();
  LAMA_PHASES.transition(ctx, 'turn');
  if (starterId != null) ctx.turn.to(starterId);
}

function isCurrentPlayer(playerId: number, ctx: RuleContext): boolean {
  return ctx.players.current()?.id === playerId;
}

function requireCurrentPlayer(playerId: number, ctx: RuleContext): void {
  if (!isCurrentPlayer(playerId, ctx)) rejectRule("Ce n'est pas votre tour");
}

function endRound(
  state: LamaState,
  winnerId: number | null,
  ctx: RuleContext,
): void {
  completeRound(ctx, {
    winnerPlayerIds: winnerId == null ? [] : [winnerId],
    next: false,
  });
  LAMA_PHASES.transition(ctx, 'return');
  ctx.events.message('game.round.ended', { round: ctx.round.number });
  if (
    winnerId != null &&
    ctx.round.number >= lamaConfig(ctx).returnTokenFromRound &&
    ctx.score.get(winnerId) > 0
  ) {
    ctx.turn.to(winnerId);
    const options = [0, 1];
    if (ctx.score.get(winnerId) >= 10) options.unshift(10);
    ctx.choice.one({
      id: 'lama.return',
      player: winnerId,
      options,
      label: (value) =>
        value === 10 ? 'Rendre un diamant' : `Rendre ${value} jeton`,
    });
    return;
  }
  advanceAfterLamaRound(state, ctx);
}

export function scoreLamaRound(_state: LamaState, ctx: RuleContext): void {
  for (const player of ctx.players.all()) {
    if (!isActive(player.id, ctx)) continue;
    const unique = new Set(ctx.cards.hand<LamaCard>(HANDS, player.id));
    ctx.score.add(
      player.id,
      [...unique].reduce((total, card) => total + lamaPenalty(card), 0),
    );
  }
}

function advanceAfterLamaRound(_state: LamaState, ctx: RuleContext): void {
  const players = ctx.players.all();
  for (const player of ctx.players.active()) {
    if (ctx.score.get(player.id) >= lamaConfig(ctx).loseAtScore) {
      ctx.match.eliminate(player.id, 'score-limit');
    }
  }
  const survivors = ctx.players.active();
  if (survivors.length <= 1) {
    const winnerId =
      survivors[0]?.id ??
      [...players].sort(
        (left, right) => ctx.score.get(left.id) - ctx.score.get(right.id),
      )[0].id;
    ctx.match.finish({ winners: [winnerId], reason: 'last-below-limit' });
    return;
  }
  const config = lamaConfig(ctx);
  if (config.roundPauseSeconds > 0) {
    LAMA_PHASES.transition(ctx, 'pause');
    ctx.choice.one({
      id: 'lama.pause',
      player: ctx.config.owner() ?? players[0].id,
      options: ['continue'],
      timeout: {
        afterMs: config.roundPauseSeconds * 1_000,
        strategy: 'first',
      },
      label: () => 'Continuer',
    });
  } else completeRound(ctx, { end: false, next: 'rotate' });
}

function lamaConfig(ctx: RuleContext): LamaConfig {
  return ctx.config.values<LamaConfig>();
}

function playableValues(playerId: number, ctx: RuleContext): LamaCard[] {
  const discard = ctx.cards.discardPile<LamaCard>(DECK);
  const top = discard.at(-1);
  if (top == null) return [];
  const allowed = new Set([top, nextLamaValue(top)]);
  return [...new Set(ctx.cards.hand<LamaCard>(HANDS, playerId))].filter(
    (card) => allowed.has(card),
  );
}

function activeRoundPlayers(ctx: RuleContext): number[] {
  return ctx.round.activePlayers().map((player) => player.id);
}

function isActive(playerId: number, ctx: RuleContext): boolean {
  return ctx.match.playerStatus(playerId) === 'active';
}
