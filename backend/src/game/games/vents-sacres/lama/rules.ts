import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  buildLamaDeck,
  lamaLabel,
  lamaPenalty,
  nextLamaValue,
  type LamaCard,
} from './content';
import type { LamaConfig, LamaState } from './state';

type RuleContext = GameRuleContext<LamaState>;
const DECK = 'lama';
const HANDS = 'lama-hands';

const configInput = gameInput.object({
  loseAtScore: gameInput.optional(
    gameInput.number({ integer: true, min: 5, max: 200 }),
  ),
  roundPauseSeconds: gameInput.optional(
    gameInput.number({ integer: true, min: 0, max: 120 }),
  ),
  allowPlayAfterDraw: gameInput.optional(gameInput.boolean()),
  startingHandSize: gameInput.optional(
    gameInput.number({ integer: true, min: 1, max: 20 }),
  ),
  copiesPerCardValue: gameInput.optional(
    gameInput.number({ integer: true, min: 1, max: 20 }),
  ),
  returnTokenFromRound: gameInput.optional(
    gameInput.number({ integer: true, min: 1, max: 50 }),
  ),
});

export const setConfig = defineAction<LamaState, Partial<LamaConfig>>({
  input: configInput,
  documentation: 'Configure LAMA et démarre la première manche.',
  available: ({ state, actor, ctx }) =>
    !state.configured && actor.id === state.ownerId && ctx.phase() === 'setup',
  execute: ({ state, input, ctx }) => {
    const config: LamaConfig = {
      loseAtScore: input.loseAtScore ?? state.config.loseAtScore,
      roundPauseSeconds:
        input.roundPauseSeconds ?? state.config.roundPauseSeconds,
      allowPlayAfterDraw:
        input.allowPlayAfterDraw ?? state.config.allowPlayAfterDraw,
      startingHandSize: input.startingHandSize ?? state.config.startingHandSize,
      copiesPerCardValue:
        input.copiesPerCardValue ?? state.config.copiesPerCardValue,
      returnTokenFromRound:
        input.returnTokenFromRound ?? state.config.returnTokenFromRound,
    };
    const requiredCards =
      ctx.players.all().length * config.startingHandSize + 1;
    if (requiredCards > config.copiesPerCardValue * 7)
      throw new Error('Configuration LAMA: paquet trop petit');
    state.config = config;
    state.configured = true;
    ctx.transitionTo('playing');
    startRound(state, ctx);
  },
});

export const play = defineAction<LamaState, { value: number }>({
  input: gameInput.object({
    value: gameInput.number({ integer: true, min: 1, max: 7 }),
  }),
  documentation:
    'Joue une carte égale ou immédiatement supérieure à la défausse.',
  available: ({ state, actor, ctx }) =>
    state.step === 'turn' && playableValues(actor.id, ctx).length > 0,
  availableInputs: ({ actor, ctx }) =>
    playableValues(actor.id, ctx).map((value) => ({ value })),
  execute: ({ state, actor, input, ctx }) => {
    const value = input.value as LamaCard;
    if (!playableValues(actor.id, ctx).includes(value))
      throw new Error('Carte LAMA injouable');
    ctx.cards.play(HANDS, DECK, actor.id, value);
    state.drawnThisTurn = false;
    ctx.history.add(`${actor.username} joue ${lamaLabel(value)}.`);
    if (ctx.cards.hand<LamaCard>(HANDS, actor.id).length === 0)
      endRound(state, actor.id, ctx);
    else ctx.turn.end();
  },
});

export const draw = defineAction<LamaState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Pioche au plus une carte pendant le tour.',
  available: ({ state, ctx }) =>
    state.step === 'turn' &&
    !state.drawnThisTurn &&
    ctx.cards.deckCount(DECK) > 0,
  execute: ({ state, actor, ctx }) => {
    const card = ctx.cards.draw<LamaCard>(DECK);
    if (card == null) throw new Error('Pioche LAMA vide');
    ctx.cards.give(HANDS, actor.id, card);
    ctx.history.add(`${actor.username} pioche ${lamaLabel(card)}.`);
    if (state.config.allowPlayAfterDraw) state.drawnThisTurn = true;
    else {
      state.drawnThisTurn = false;
      ctx.turn.end();
    }
  },
});

export const pass = defineAction<LamaState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Termine le tour après une pioche lorsque cette option est active.',
  available: ({ state }) =>
    state.step === 'turn' &&
    state.config.allowPlayAfterDraw &&
    state.drawnThisTurn,
  execute: ({ state, actor, ctx }) => {
    state.drawnThisTurn = false;
    ctx.history.add(`${actor.username} passe.`);
    ctx.turn.end();
  },
});

export const quit = defineAction<LamaState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Se retire de la manche en conservant ses cartes pour le décompte.',
  available: ({ state, actor }) =>
    state.step === 'turn' && !state.droppedOut[actor.id],
  execute: ({ state, actor, ctx }) => {
    state.droppedOut[actor.id] = true;
    state.drawnThisTurn = false;
    ctx.history.add(`${actor.username} se retire de la manche.`);
    if (activeRoundPlayers(state, ctx).length === 0) endRound(state, null, ctx);
    else ctx.turn.end();
  },
});

export const LAMA_ACTIONS = {
  lama_set_config: setConfig,
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
  const playerId = state.roundWinnerId;
  if (state.step !== 'return' || playerId == null)
    throw new Error('Rendu de jetons LAMA absent');
  if (value !== 0 && value !== 1 && value !== 10)
    throw new Error('Rendu de jetons LAMA invalide');
  if (value > state.scores[playerId])
    throw new Error('Jetons LAMA insuffisants');
  state.scores[playerId] -= value;
  ctx.history.add(
    `${ctx.players.get(playerId)?.username} rend ${value} jeton(s).`,
  );
  state.roundWinnerId = null;
  finishRound(state, ctx);
}

export function resolvePause(state: LamaState, ctx: RuleContext): void {
  if (state.step !== 'pause') throw new Error('Pause LAMA absente');
  startRound(state, ctx);
}

export function skipInactiveLamaPlayer(
  state: LamaState,
  ctx: RuleContext,
): void {
  state.drawnThisTurn = false;
  ctx.turn.end();
}

function startRound(state: LamaState, ctx: RuleContext): void {
  const players = ctx.players.all();
  const survivors = players.filter((player) => !state.eliminated[player.id]);
  const deck = buildLamaDeck(state.config.copiesPerCardValue);
  ctx.cards.resetDeck(DECK, deck, { shuffle: true });
  ctx.cards.clearHands(
    HANDS,
    players.map((player) => player.id),
  );
  ctx.cards.deal(
    DECK,
    HANDS,
    survivors.map((player) => player.id),
    state.config.startingHandSize,
  );
  const first = ctx.cards.draw<LamaCard>(DECK);
  if (first == null) throw new Error('Paquet LAMA insuffisant');
  ctx.cards.discard(DECK, first);
  state.droppedOut = Object.fromEntries(
    players.map((player) => [player.id, state.eliminated[player.id]]),
  );
  state.drawnThisTurn = false;
  state.step = 'turn';
  state.roundWinnerId = null;
  const starter = nextSurvivorIndex(
    players.map((player) => player.id),
    state.eliminated,
    state.roundStarterIndex - 1,
  );
  state.roundStarterIndex = starter;
  ctx.turn.to(players[starter].id);
  ctx.history.add(
    `Début de la manche ${state.roundNumber}. Défausse : ${lamaLabel(first)}.`,
  );
}

function endRound(
  state: LamaState,
  winnerId: number | null,
  ctx: RuleContext,
): void {
  for (const player of ctx.players.all()) {
    if (state.eliminated[player.id]) continue;
    const unique = new Set(ctx.cards.hand<LamaCard>(HANDS, player.id));
    state.scores[player.id] += [...unique].reduce(
      (total, card) => total + lamaPenalty(card),
      0,
    );
  }
  state.roundWinnerId = winnerId;
  state.step = 'return';
  ctx.history.add(`Fin de la manche ${state.roundNumber}.`);
  if (
    winnerId != null &&
    state.roundNumber >= state.config.returnTokenFromRound &&
    state.scores[winnerId] > 0
  ) {
    ctx.turn.to(winnerId);
    const options = [0, 1];
    if (state.scores[winnerId] >= 10) options.unshift(10);
    ctx.choice.one({
      id: 'lama.return',
      player: winnerId,
      options,
      label: (value) =>
        value === 10 ? 'Rendre un diamant' : `Rendre ${value} jeton`,
    });
    return;
  }
  state.roundWinnerId = null;
  finishRound(state, ctx);
}

function finishRound(state: LamaState, ctx: RuleContext): void {
  const players = ctx.players.all();
  for (const player of players)
    state.eliminated[player.id] =
      state.scores[player.id] >= state.config.loseAtScore;
  const survivors = players.filter((player) => !state.eliminated[player.id]);
  if (survivors.length <= 1) {
    state.winnerId =
      survivors[0]?.id ??
      [...players].sort(
        (left, right) => state.scores[left.id] - state.scores[right.id],
      )[0].id;
    return;
  }
  state.roundNumber += 1;
  state.roundStarterIndex = nextSurvivorIndex(
    players.map((player) => player.id),
    state.eliminated,
    state.roundStarterIndex,
  );
  if (state.config.roundPauseSeconds > 0) {
    state.step = 'pause';
    ctx.choice.one({
      id: 'lama.pause',
      player: state.ownerId,
      options: ['continue'],
      timeoutMs: state.config.roundPauseSeconds * 1_000,
      label: () => 'Continuer',
    });
  } else startRound(state, ctx);
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

function activeRoundPlayers(state: LamaState, ctx: RuleContext): number[] {
  return ctx.players
    .all()
    .map((player) => player.id)
    .filter((id) => !state.eliminated[id] && !state.droppedOut[id]);
}

function nextSurvivorIndex(
  playerIds: number[],
  eliminated: Record<number, boolean>,
  afterIndex: number,
): number {
  for (let distance = 1; distance <= playerIds.length; distance += 1) {
    const index = (afterIndex + distance + playerIds.length) % playerIds.length;
    if (!eliminated[playerIds[index]]) return index;
  }
  return 0;
}
