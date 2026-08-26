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
import { MISSION_GALAXIE_CONTENT } from './content';
import {
  MISSION_GALAXIE_ACTIONS,
  resolveMissionChoice,
  skipMissionPlayer,
} from './rules';
import type { MissionGalaxiePlayerView, MissionGalaxieState } from './state';

const decks = [
  cards.deck({
    id: 'questions',
    cards: MISSION_GALAXIE_CONTENT.questions,
    shuffle: true,
  }),
  cards.deck({
    id: 'challenges',
    cards: MISSION_GALAXIE_CONTENT.challenges,
    shuffle: true,
  }),
  cards.deck({
    id: 'events',
    cards: MISSION_GALAXIE_CONTENT.events,
    shuffle: true,
  }),
];

export default defineGame<
  MissionGalaxieState,
  typeof MISSION_GALAXIE_ACTIONS,
  MissionGalaxiePlayerView
>({
  id: 'mission-galaxie',
  displayName: 'Mission Galaxie',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description:
    'Une course cosmique rythmée par questions, défis et événements.',
  players: { min: 2, max: 6 },
  components: [
    movement.track({
      id: 'galaxy',
      spaces: MISSION_GALAXIE_CONTENT.tiles.length,
    }),
    diceKit({ id: 'main', count: 1, sides: 6 }),
    ...decks,
  ],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
  ],
  setup: ({ players }) => ({
    skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
    lastRoll: null,
    winnerId: null,
    pendingChoice: null,
  }),
  turn: clockwise(),
  actions: MISSION_GALAXIE_ACTIONS,
  choices: {
    'mission-galaxie.choice': {
      resolve: ({ state, value, ctx }) =>
        resolveMissionChoice(state, value, ctx),
    },
  },
  automatic: [
    when(
      'skip-mission-player',
      ({ state, ctx }) =>
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipMissionPlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'legendary-planet' },
  ),
  view: ({ state, actor, ctx }) => {
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('galaxy', player.id),
        ]),
    );
    const deckCounts = Object.fromEntries(
      (['questions', 'challenges', 'events'] as const).map((id) => [
        id,
        ctx.cards.deckCount(id) + ctx.cards.discardCount(id),
      ]),
    ) as MissionGalaxiePlayerView['deckCounts'];
    const pendingCard =
      actor &&
      state.pendingChoice?.kind === 'answer' &&
      state.pendingChoice.actorId === actor.id
        ? {
            title: state.pendingChoice.card.title,
            prompt: state.pendingChoice.card.prompt,
            choices: structuredClone(state.pendingChoice.card.choices),
          }
        : null;
    const { pendingChoice: _pendingChoice, ...publicState } = state;
    return playerView({
      game: { ...structuredClone(publicState), positions, deckCounts },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        pendingCard,
      },
      board: {
        tiles: structuredClone(MISSION_GALAXIE_CONTENT.tiles),
        positions,
      },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
