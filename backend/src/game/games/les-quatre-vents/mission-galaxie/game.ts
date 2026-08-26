import {
  cards,
  defineChoice,
  defineGame,
  gameInput,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import { MISSION_GALAXIE_CONTENT } from './content';
import {
  MISSION_GALAXIE_ACTIONS,
  MISSION_GALAXIE_EFFECTS,
  resolveMissionAnswer,
  resolveMissionEventMove,
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
  patterns: [
    raceGame({
      trackId: 'galaxy',
      spaces: MISSION_GALAXIE_CONTENT.tiles.length,
    }),
  ],
  components: [...decks],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
  ],
  setup: () => ({}),
  actions: MISSION_GALAXIE_ACTIONS,
  effects: MISSION_GALAXIE_EFFECTS,
  choices: {
    'mission-galaxie.answer': defineChoice<MissionGalaxieState, number>({
      input: gameInput.number({ integer: true, min: 0 }),
      resolve: ({ state, value, ctx }) =>
        resolveMissionAnswer(state, value, ctx),
    }),
    'mission-galaxie.event-move': defineChoice<MissionGalaxieState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, value, ctx }) =>
        resolveMissionEventMove(state, value, ctx),
    }),
  },
  view: ({ state: _state, actor, ctx }) => {
    const positions = ctx.players.byId((player) =>
      ctx.movement.position('galaxy', player.id),
    );
    const pending =
      ctx.choice.continuation<import('./state').MissionGalaxiePending>();
    const pendingCard =
      actor && pending?.kind === 'answer' && pending.actorId === actor.id
        ? (MISSION_GALAXIE_CONTENT[pending.deck].find(
            (card) => card.id === pending.cardId,
          ) ?? null)
        : null;
    return playerView({
      game: {},
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        pendingCard: pendingCard
          ? {
              title: pendingCard.title,
              prompt: pendingCard.prompt,
              choices: structuredClone(pendingCard.choices),
            }
          : null,
      },
      board: {
        tiles: MISSION_GALAXIE_CONTENT.tiles,
        positions,
      },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
