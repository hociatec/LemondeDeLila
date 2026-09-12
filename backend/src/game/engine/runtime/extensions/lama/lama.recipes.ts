import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { cards } from '../../cards/cards-kit';
import { defineCardsSchema } from '../../cards/typed-cards';
import { defineConfiguration } from '../../configuration/configuration-kit';
import type { LamaCard, LamaConfig, LamaProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { when } from '../../automation/automatic-kit';
import { defineGamePhases } from '../../kits/phase-kit';
import { cardGame } from '../../patterns/gameplay-pattern-track-card';
import { roundScoring } from '../../patterns/gameplay-pattern-round-economy';
import { completeRound } from '../../recipes/gameplay/track-round.recipes';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';

type State = Record<string, never>;
type Context = GameContext<State>;
const VALUES: readonly LamaCard[] = [1, 2, 3, 4, 5, 6, 'LAMA'];

export function nextLamaValue(value: LamaCard): LamaCard {
  return VALUES[(VALUES.indexOf(value) + 1) % VALUES.length];
}
export function scoreLamaHand(cards: readonly LamaCard[]): number {
  return [...new Set(cards)].reduce(
    (total, card) => total + (card === 'LAMA' ? 10 : card),
    0,
  );
}

export function lamaRules(source: LamaProgram) {
  const program = structuredClone(source);
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
    const play = defineAction<State, { value: LamaCard }>({
      ui: { label: 'Jouer une carte', control: 'card' },
      input: gameInput.object({
        value: gameInput.union([
          gameInput.numberEnum([1, 2, 3, 4, 5, 6] as const),
          gameInput.literal('LAMA'),
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
          rejectRule('Carte LAMA injouable');
        ctx.cards.play(program.handId, program.deckId, actor.id, input.value);
        ctx.events.message('game.card.played', {
          playerId: actor.id,
          cardId: input.value,
          cardLabel: String(input.value),
        });
        if (ctx.cards.hand<LamaCard>(program.handId, actor.id).length === 0)
          endRound(actor.id, ctx);
        else ctx.turn.end();
      },
    });
    const draw = defineAction<State, Record<string, never>>({
      ui: { label: 'Piocher', control: 'button', shortcut: 'Space' },
      input: gameInput.object({}),
      documentation:
        "Pioche au plus une carte pendant le tour, tant qu'aucun joueur n'est sorti de la manche.",
      available: ({ actor, ctx }) =>
        current(actor.id, ctx) &&
        phases.is(ctx, 'turn') &&
        ctx.round.leftPlayers().length === 0 &&
        !ctx.turn.flags.get<boolean>(program.drawnTurnFlag) &&
        ctx.cards.deckCount(program.deckId) > 0,
      execute: ({ actor, ctx }) => {
        ctx.turn.requireCurrent(actor.id);
        const card = ctx.cards.draw<LamaCard>(program.deckId);
        if (card == null) rejectRule('Pioche LAMA vide');
        ctx.cards.give(program.handId, actor.id, card);
        ctx.events.message('game.card.drawn', {
          playerId: actor.id,
          deckId: program.deckId,
        });
        if (config(ctx).allowPlayAfterDraw)
          ctx.turn.flags.set(program.drawnTurnFlag);
        else ctx.turn.end();
      },
    });
    const pass = defineAction<State, Record<string, never>>({
      ui: { label: 'Passer', control: 'button' },
      input: gameInput.object({}),
      documentation:
        'Termine le tour après une pioche lorsque cette option est active.',
      available: ({ actor, ctx }) =>
        current(actor.id, ctx) &&
        phases.is(ctx, 'turn') &&
        config(ctx).allowPlayAfterDraw &&
        ctx.turn.flags.get<boolean>(program.drawnTurnFlag) === true,
      execute: ({ actor, ctx }) => {
        ctx.turn.requireCurrent(actor.id);
        ctx.events.message('game.player.passed', { playerId: actor.id });
        ctx.turn.end();
      },
    });
    const quit = defineAction<State, Record<string, never>>({
      ui: { label: 'Sortir de la manche', control: 'button', shortcut: 'P' },
      input: gameInput.object({}),
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

  function config(ctx: Context): LamaConfig {
    return ctx.config.values<LamaConfig>();
  }
  function current(playerId: number, ctx: Context): boolean {
    return ctx.players.current()?.id === playerId;
  }
  function playable(playerId: number, ctx: Context): LamaCard[] {
    const top = ctx.cards.discardPile<LamaCard>(program.deckId).at(-1);
    if (top == null) return [];
    const allowed = new Set([top, nextLamaValue(top)]);
    return [
      ...new Set(ctx.cards.hand<LamaCard>(program.handId, playerId)),
    ].filter((card) => allowed.has(card));
  }
  function scoreRound(ctx: Context): void {
    for (const player of ctx.players.all()) {
      if (ctx.match.playerStatus(player.id) !== 'active') continue;
      ctx.score.add(
        player.id,
        scoreLamaHand(ctx.cards.hand<LamaCard>(program.handId, player.id)),
      );
    }
  }
  function prepareRound(ctx: Context): void {
    const players = ctx.players.all();
    const survivors = ctx.round.activePlayers();
    const values = config(ctx);
    const counts = new Map<LamaCard, number>();
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
    const first = ctx.cards.draw<LamaCard>(program.deckId);
    if (first == null) rejectRule('Paquet LAMA insuffisant');
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
    config: defineConfiguration<State, LamaConfig>({
      input: gameInput.object({
        loseAtScore: gameInput.label(
          "Seuil de jetons d'élimination",
          gameInput.number({ integer: true, min: 5, max: 200 }),
        ),
        roundPauseSeconds: gameInput.label(
          'Pause entre les manches en secondes',
          gameInput.number({ integer: true, min: 0, max: 120 }),
        ),
        allowPlayAfterDraw: gameInput.label(
          'Autoriser à jouer après avoir pioché',
          gameInput.boolean(),
        ),
        startingHandSize: gameInput.label(
          'Nombre de cartes initiales',
          gameInput.number({ integer: true, min: 1, max: 20 }),
        ),
        copiesPerCardValue: gameInput.label(
          'Exemplaires de chaque valeur',
          gameInput.number({ integer: true, min: 1, max: 20 }),
        ),
        returnTokenFromRound: gameInput.label(
          'Rendre un jeton à partir de la manche',
          gameInput.number({ integer: true, min: 1, max: 50 }),
        ),
      }),
      defaults: program.defaults,
      phase: phases.initialPhase,
      permission: 'owner',
      ui: { title: 'Configuration LAMA', submitLabel: 'Démarrer la partie' },
      validate: ({ config: values, ctx }) =>
        ctx.players.count() * values.startingHandSize + 1 <=
        values.copiesPerCardValue * VALUES.length,
      onConfigured: ({ ctx }) => {
        phases.transition(ctx, 'turn');
        ctx.round.start(ctx.players.active()[0]?.id);
      },
    }),
    choices: {
      [program.returnChoiceId]: defineChoice<State, number>({
        input: gameInput.number({ integer: true, min: 0, max: 10 }),
        resolve: ({ value, ctx }) => {
          const playerId = ctx.round.winners()[0] ?? null;
          if (!phases.is(ctx, 'return') || playerId == null)
            rejectRule('Rendu de jetons LAMA absent');
          if (![0, 1, 10].includes(value))
            rejectRule('Rendu de jetons LAMA invalide');
          if (value > ctx.score.get(playerId))
            rejectRule('Jetons LAMA insuffisants');
          ctx.score.subtract(playerId, value);
          advance(ctx);
        },
      }),
      [program.pauseChoiceId]: defineChoice<State, string>({
        input: gameInput.literal('continue'),
        resolve: ({ ctx }) => {
          if (!phases.is(ctx, 'pause')) rejectRule('Pause LAMA absente');
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
        'skip-inactive-lama-player',
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
      if (available.includes('lama_play')) {
        const value = playable(actorId, ctx)[0];
        if (value != null) return { recipe: 'lama-play', payload: { value } };
      }
      if (available.includes('draw'))
        return { recipe: 'lama-draw', payload: {} };
      if (
        ctx.turn.flags.get<boolean>(program.drawnTurnFlag) &&
        available.includes('lama_pass')
      )
        return { recipe: 'lama-pass', payload: {} };
      return available.includes('lama_quit')
        ? { recipe: 'lama-quit', payload: {} }
        : null;
    },
    scoreRound,
  });
  return buildDefinition();
}
