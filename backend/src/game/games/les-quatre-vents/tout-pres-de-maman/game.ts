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
import { MAMAN_CONTENT } from './content';
import {
  resolveMamanChoice,
  skipRestingPlayer,
  TOUT_PRES_DE_MAMAN_ACTIONS,
} from './rules';
import type { ToutPresDeMamanPlayerView, ToutPresDeMamanState } from './state';

const track = movement.track({
  id: 'forest',
  spaces: MAMAN_CONTENT.tiles.length,
});
const deck = cards.deck({
  id: 'events',
  cards: MAMAN_CONTENT.cards,
  shuffle: true,
});

export default defineGame<
  ToutPresDeMamanState,
  typeof TOUT_PRES_DE_MAMAN_ACTIONS,
  ToutPresDeMamanPlayerView
>({
  id: 'tout-pres-de-maman',
  displayName: 'Tout près de Maman !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Collectez les eucalyptus et retrouvez maman.',
  players: { min: 2, max: 6 },
  components: [track, deck, diceKit({ id: 'main', count: 1, sides: 6 })],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  setup: ({ players }) => ({
    tokens: Object.fromEntries(players.map((player) => [player.id, 2])),
    skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
    bonusReroll: Object.fromEntries(
      players.map((player) => [player.id, false]),
    ),
    lastRoll: null,
    winnerId: null,
    pendingChoice: null,
  }),
  turn: clockwise(),
  actions: TOUT_PRES_DE_MAMAN_ACTIONS,
  choices: {
    'maman.target': {
      resolve: ({ state, value, ctx }) =>
        resolveMamanChoice(state, Number(value), ctx),
    },
  },
  automatic: [
    when(
      'skip-resting-player',
      ({ state, ctx }) =>
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipRestingPlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'maman-found' },
  ),
  view: ({ state, actor, ctx }) => {
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('forest', player.id),
        ]),
    );
    const { pendingChoice: _pendingChoice, ...publicGame } = state;
    return playerView({
      game: {
        ...structuredClone(publicGame),
        positions,
        deckCount: ctx.cards.deckCount('events'),
        discardCount: ctx.cards.discardCount('events'),
      },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        tokens: structuredClone(state.tokens),
        ui: {
          panels: [
            {
              title: 'Eucalyptus',
              lines: ctx.players
                .all()
                .map(
                  (player) => `${player.username} : ${state.tokens[player.id]}`,
                ),
            },
          ],
        },
      },
      board: { tiles: structuredClone(MAMAN_CONTENT.tiles), positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
