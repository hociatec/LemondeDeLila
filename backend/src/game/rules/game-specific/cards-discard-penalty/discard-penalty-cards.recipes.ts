import {
  gameInput,
  cards,
  defineCardsSchema,
  when,
  defineGamePhases,
  cardGame,
  roundScoring,
  completeRound,
  type GameContext,
} from '../../../engine/sdk/public-api';
import {
  defineAction,
  defineChoice,
  defineEmptyAction,
} from '../../../engine/sdk/extension-api';
import { discardPenaltyConfiguration } from './discard-penalty-configuration';
import type {
  DiscardPenaltyCardsCard,
  DiscardPenaltyCardsConfig,
  DiscardPenaltyCardsProgram,
} from './program';
import { rejectRule } from '../../../engine/sdk/extension-api';

type State = Record<string, never>;
type Context = GameContext<State>;
export function nextDiscardPenaltyCardsValue(
  values: readonly DiscardPenaltyCardsCard[],
  value: DiscardPenaltyCardsCard,
): DiscardPenaltyCardsCard {
  return values[(values.indexOf(value) + 1) % values.length];
}
export function scoreDiscardPenaltyCardsHand(
  cards: readonly DiscardPenaltyCardsCard[],
  specialValue: DiscardPenaltyCardsCard,
  specialScore: number,
): number {
  return [...new Set(cards)].reduce<number>(
    (total, card) =>
      total +
      (card === specialValue
        ? specialScore
        : typeof card === 'number'
          ? card
          : 0),
    0,
  );
}

export function discardPenaltyCardsRules(source: DiscardPenaltyCardsProgram) {
  const program = structuredClone(source);
  const drawnSchema = gameInput.boolean();
  const hasDrawn = (ctx: Context): boolean => {
    const value = ctx.turn.flags.get(program.drawnTurnFlag);
    return value == null
      ? false
      : drawnSchema.parse(value, 'turn.flags.' + program.drawnTurnFlag);
  };
  const phases = defineGamePhases<State>()({
    initialPhase: 'setup',
    phases: {
      setup: { transitions: ['turn'] },
      turn: { transitions: ['return'] },
      return: { transitions: ['pause', 'turn'] },
      pause: { transitions: ['turn'] },
    },
  });
  const createActions = () => {
    const play = defineAction<State, { value: DiscardPenaltyCardsCard }>({
      ui: { label: 'Jouer une carte', control: 'card' },
      input: gameInput.object({
        value: gameInput.union([
          gameInput.number({ integer: true }),
          gameInput.string({ min: 1, max: 128 }),
        ]),
      }),
      documentation:
        'Joue une carte égale ou immédiatement supérieure à la défausse.',
      available: ({ actor, ctx }) =>
        current(actor.id, ctx) &&
        phases.is(ctx, 'turn') &&
        playable(actor.id, ctx).length > 0,
      validate: ({ actor, input, ctx }) =>
        current(actor.id, ctx) && playable(actor.id, ctx).includes(input.value),
      enumerate: ({ actor, ctx }) =>
        playable(actor.id, ctx).map((value) => ({ value })),
      execute: ({ actor, input, ctx }) => {
        ctx.turn.requireCurrent(actor.id);
        if (!playable(actor.id, ctx).includes(input.value))
          rejectRule('Carte de pénalité injouable');
        ctx.cards.play(program.handId, program.deckId, actor.id, input.value);
        ctx.events.message('game.card.played', {
          playerId: actor.id,
          cardId: input.value,
          cardLabel: String(input.value),
        });
        if (
          ctx.cards.hand<DiscardPenaltyCardsCard>(program.handId, actor.id)
            .length === 0
        )
          endRound(actor.id, ctx);
        else ctx.turn.end();
      },
    });
    const draw = defineEmptyAction<State>({
      ui: { label: 'Piocher', control: 'button', shortcut: 'Space' },
      documentation:
        "Pioche au plus une carte pendant le tour, tant qu'aucun joueur n'est sorti de la manche.",
      available: ({ actor, ctx }) =>
        current(actor.id, ctx) &&
        phases.is(ctx, 'turn') &&
        ctx.round.leftPlayers().length === 0 &&
        !hasDrawn(ctx) &&
        ctx.cards.deckCount(program.deckId) > 0,
      execute: ({ actor, ctx }) => {
        ctx.turn.requireCurrent(actor.id);
        const card = ctx.cards.draw<DiscardPenaltyCardsCard>(program.deckId);
        if (card == null) rejectRule('Pioche de pénalité vide');
        ctx.cards.give(program.handId, actor.id, card);
        ctx.events.message('game.card.drawn', {
          playerId: actor.id,
          deckId: program.deckId,
        });
        if (
          config(ctx).allowPlayAfterDraw &&
          playable(actor.id, ctx).length > 0
        )
          ctx.turn.flags.set(program.drawnTurnFlag);
        else ctx.turn.end();
      },
    });
    const pass = defineEmptyAction<State>({
      ui: { label: 'Passer', control: 'button' },
      documentation:
        'Termine le tour après une pioche lorsque cette option est active.',
      available: ({ actor, ctx }) =>
        current(actor.id, ctx) &&
        phases.is(ctx, 'turn') &&
        config(ctx).allowPlayAfterDraw &&
        hasDrawn(ctx) === true,
      execute: ({ actor, ctx }) => {
        ctx.turn.requireCurrent(actor.id);
        ctx.events.message('game.player.passed', { playerId: actor.id });
        ctx.turn.end();
      },
    });
    const quit = defineEmptyAction<State>({
      ui: { label: 'Sortir de la manche', control: 'button', shortcut: 'P' },
      documentation:
        'Se retire de la manche en conservant ses cartes pour le décompte.',
      available: ({ actor, ctx }) =>
        current(actor.id, ctx) &&
        phases.is(ctx, 'turn') &&
        ctx.round.activePlayers().some((player) => player.id === actor.id),
      execute: ({ actor, ctx }) => {
        ctx.turn.requireCurrent(actor.id);
        ctx.round.leave(actor.id);
        if (ctx.round.activePlayers().length === 0) endRound(null, ctx);
        else ctx.turn.end();
      },
    });
    return { play, draw, pass, quit };
  };
  const { play, draw, pass, quit } = createActions();
  const scoring = roundScoring<State>({ score: ({ ctx }) => scoreRound(ctx) });
  const cardSchema = defineCardsSchema({
    decks: {
      [program.deckId]: cards.deck({
        id: program.deckId,
        cards: program.cards,
        shuffle: true,
        empty: 'recycle',
      }),
    },
    hands: {
      [program.handId]: cards.hands({
        id: program.handId,
        deck: program.deckId,
        initial: 0,
        visibility: 'owner',
        ownerVisibility: 'active-round',
      }),
    },
  });

  function config(ctx: Context): DiscardPenaltyCardsConfig {
    return ctx.config.values<DiscardPenaltyCardsConfig>();
  }
  function current(playerId: number, ctx: Context): boolean {
    return ctx.players.current()?.id === playerId;
  }
  function playable(playerId: number, ctx: Context): DiscardPenaltyCardsCard[] {
    const top = ctx.cards
      .discardPile<DiscardPenaltyCardsCard>(program.deckId)
      .at(-1);
    if (top == null) return [];
    const allowed = new Set([
      top,
      nextDiscardPenaltyCardsValue(program.orderedValues, top),
    ]);
    return [
      ...new Set(
        ctx.cards.hand<DiscardPenaltyCardsCard>(program.handId, playerId),
      ),
    ].filter((card) => allowed.has(card));
  }
  function scoreRound(ctx: Context): void {
    for (const player of ctx.players.all()) {
      if (ctx.match.playerStatus(player.id) !== 'active') continue;
      ctx.score.add(
        player.id,
        scoreDiscardPenaltyCardsHand(
          ctx.cards.hand<DiscardPenaltyCardsCard>(program.handId, player.id),
          program.specialValue,
          program.specialScore,
        ),
      );
    }
  }
  function prepareRound(ctx: Context): void {
    const players = ctx.players.all();
    const survivors = ctx.round.activePlayers();
    const values = config(ctx);
    const counts = new Map<DiscardPenaltyCardsCard, number>();
    const deck = program.cards.filter((card) => {
      const count = counts.get(card) ?? 0;
      counts.set(card, count + 1);
      return count < values.copiesPerCardValue;
    });
    ctx.cards.resetDeck(program.deckId, deck, { shuffle: true });
    ctx.cards.clearHands(
      program.handId,
      players.map((player) => player.id),
    );
    const starterId = ctx.round.starter() ?? survivors[0]?.id;
    ctx.events.message('game.round.started', {
      round: ctx.round.number,
      starterPlayerId: starterId,
    });
    ctx.cards.deal(
      program.deckId,
      program.handId,
      survivors.map((player) => player.id),
      values.startingHandSize,
    );
    const first = ctx.cards.draw<DiscardPenaltyCardsCard>(program.deckId);
    if (first == null) rejectRule('Paquet de pénalité insuffisant');
    ctx.cards.discard(program.deckId, first);
    ctx.turn.flags.clear();
    phases.transition(ctx, 'turn');
    if (starterId != null) ctx.turn.to(starterId);
  }
  function endRound(winnerId: number | null, ctx: Context): void {
    completeRound(ctx, {
      winnerPlayerIds: winnerId == null ? [] : [winnerId],
      next: false,
    });
    phases.transition(ctx, 'return');
    ctx.events.message('game.round.ended', { round: ctx.round.number });
    if (
      winnerId != null &&
      ctx.round.number >= config(ctx).returnTokenFromRound &&
      ctx.score.get(winnerId) > 0
    ) {
      ctx.turn.to(winnerId);
      const options = [0, 1];
      if (ctx.score.get(winnerId) >= 10) options.unshift(10);
      ctx.choice.one({
        id: program.returnChoiceId,
        player: winnerId,
        options,
        label: (value) =>
          value === 10 ? 'Rendre un diamant' : `Rendre ${value} jeton`,
      });
      return;
    }
    advance(ctx);
  }
  function advance(ctx: Context): void {
    const players = ctx.players.all();
    for (const player of ctx.players.active())
      if (ctx.score.get(player.id) >= config(ctx).loseAtScore)
        ctx.match.eliminate(player.id, 'score-limit');
    const survivors = ctx.players.active();
    if (survivors.length <= 1) {
      const winnerId =
        survivors[0]?.id ??
        ctx.ranking.rank(
          players.map((player) => player.id),
          { value: (id) => ctx.score.get(id), direction: 'asc' },
        )[0].playerId;
      ctx.match.finish({ winners: [winnerId], reason: 'last-below-limit' });
      return;
    }
    const pause = config(ctx).roundPauseSeconds;
    if (pause > 0) {
      phases.transition(ctx, 'pause');
      ctx.choice.one({
        id: program.pauseChoiceId,
        player: ctx.config.owner() ?? players[0].id,
        options: ['continue'],
        timeout: { afterMs: pause * 1_000, strategy: 'first' },
        label: () => 'Continuer',
      });
    } else completeRound(ctx, { end: false, next: 'rotate' });
  }

  const buildDefinition = () => ({
    play,
    draw,
    pass,
    quit,
    patterns: [
      cardGame({
        schema: cardSchema,
        deckId: program.deckId,
        handId: program.handId,
      }),
    ],
    initialization: { scores: 0, startRound: false },
    config: discardPenaltyConfiguration(program, phases),
    choices: {
      [program.returnChoiceId]: defineChoice<State, number>({
        input: gameInput.number({ integer: true, min: 0, max: 10 }),
        resolve: ({ value, ctx }) => {
          const playerId = ctx.round.winners()[0] ?? null;
          if (!phases.is(ctx, 'return') || playerId == null)
            rejectRule('Rendu de jetons absent');
          if (![0, 1, 10].includes(value))
            rejectRule('Rendu de jetons invalide');
          if (value > ctx.score.get(playerId))
            rejectRule('Jetons insuffisants');
          ctx.score.subtract(playerId, value);
          advance(ctx);
        },
      }),
      [program.pauseChoiceId]: defineChoice<State, string>({
        input: gameInput.literal('continue'),
        resolve: ({ ctx }) => {
          if (!phases.is(ctx, 'pause')) rejectRule('Pause de manche absente');
          completeRound(ctx, { end: false, next: 'rotate' });
        },
      }),
    },
    lifecycle: {
      ...scoring.lifecycle,
      onRoundStart: ({ ctx }: { state: State; ctx: Context }) =>
        prepareRound(ctx),
    },
    automatic: [
      when<State>(
        'skip-inactive-discardPenaltyCards-player',
        ({ ctx }) => {
          const currentId = ctx.players.current()?.id ?? 0;
          return (
            phases.is(ctx, 'turn') &&
            !ctx.round.activePlayers().some((player) => player.id === currentId)
          );
        },
        ({ ctx }) => ctx.turn.end(),
      ),
    ],
    chooseBot: (
      actorId: number,
      available: readonly string[],
      ctx: Context,
    ) => {
      if (available.includes('cards-discard-penalty-play')) {
        const value = playable(actorId, ctx)[0];
        if (value != null)
          return { recipe: 'cards-discard-penalty-play', payload: { value } };
      }
      if (available.includes('draw'))
        return { recipe: 'cards-discard-penalty-draw', payload: {} };
      if (hasDrawn(ctx) && available.includes('cards-discard-penalty-pass'))
        return { recipe: 'cards-discard-penalty-pass', payload: {} };
      return available.includes('cards-discard-penalty-quit')
        ? { recipe: 'cards-discard-penalty-quit', payload: {} }
        : null;
    },
    scoreRound,
  });
  return buildDefinition();
}
