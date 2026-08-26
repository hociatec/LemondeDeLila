import {
  cards,
  clockwise,
  defineGame,
  diceKit,
  movement,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import {
  AVENTURE_ANIMAL_CARDS,
  AVENTURE_PATTE_CARDS,
  AVENTURE_PAWNS,
  AVENTURE_TILES,
} from './content';
import {
  AVENTURE_ACTIONS,
  requestPawn,
  resolvePawnChoice,
  skipAventurePlayer,
} from './rules';
import type { AventureSauvagePlayerView, AventureSauvageState } from './state';

export default defineGame<
  AventureSauvageState,
  typeof AVENTURE_ACTIONS,
  AventureSauvagePlayerView
>({
  id: 'aventure-sauvage',
  displayName: 'Aventure Sauvage',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Une course animalière jusqu’à la mare de la jungle.',
  players: { min: 2, max: 6 },
  components: [
    movement.track({ id: 'jungle', spaces: AVENTURE_TILES.length }),
    diceKit({ id: 'main', count: 1, sides: 6 }),
    cards.deck({ id: 'animal', cards: AVENTURE_ANIMAL_CARDS, shuffle: true }),
    cards.deck({ id: 'patte', cards: AVENTURE_PATTE_CARDS, shuffle: true }),
  ],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
  ],
  setup: ({ players, ctx }) => {
    const state: AventureSauvageState = {
      pawnByPlayerId: {},
      skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
      setupComplete: false,
      lastRoll: null,
      winnerId: null,
    };
    const first = players[0];
    if (first) requestPawn(state, first.id, ctx);
    return state;
  },
  initialPhase: 'setup',
  turn: clockwise(),
  actions: AVENTURE_ACTIONS,
  choices: {
    'aventure.pawn': {
      resolve: ({ state, actor, value, ctx }) =>
        resolvePawnChoice(state, actor.id, String(value), ctx),
    },
  },
  automatic: [
    when(
      'skip-aventure-player',
      ({ state, ctx }) =>
        state.setupComplete &&
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipAventurePlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'jungle-finish' },
  ),
  view: ({ state, actor, ctx }) => {
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('jungle', player.id),
        ]),
    );
    const deckCounts = Object.fromEntries(
      (['animal', 'patte'] as const).map((id) => [
        id,
        ctx.cards.deckCount(id) + ctx.cards.discardCount(id),
      ]),
    ) as AventureSauvagePlayerView['deckCounts'];
    const pawn = actor
      ? (AVENTURE_PAWNS.find(
          (entry) => entry.id === state.pawnByPlayerId[actor.id],
        ) ?? null)
      : null;
    return playerView({
      game: { ...structuredClone(state), positions, deckCounts },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        pawn,
      },
      board: { tiles: structuredClone(AVENTURE_TILES), positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
