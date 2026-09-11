import {
  cards,
  defineCardsSchema,
  defineGame,
  pawns,
  publicField,
  raceGame,
} from '../../../engine/sdk/public-api';
import { CONTES_RESOURCES } from './constants';
import {
  CONTES_DECKS,
  CONTES_GAME_CONTENT,
  CONTES_PAWNS,
  CONTES_TILES,
} from './content';
import { CONTES_EFFECTS } from './effects';
import manifest from './manifest.json';
import { GAME_RULES } from './rule-bindings';
import { CONTES_ACTIONS, CONTES_PHASES } from './rules';
import { setupGame } from './rules';
import type { ContesState } from './types';

const cardSchema = defineCardsSchema({
  decks: Object.fromEntries(
    (['bonus', 'malus', 'surprise', 'conte'] as const).map((id) => [
      id,
      cards.deck({
        id,
        cards: CONTES_DECKS[id],
        shuffle: true,
        empty: 'recycle',
      }),
    ]),
  ),
  hands: {},
});

export default defineGame<ContesState>()({
  id: manifest.code,
  rulesVersion: '2',
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: CONTES_GAME_CONTENT,
  playerValuesVisibility: { statuses: publicField() },
  patterns: [
    raceGame({
      trackId: 'story-road',
      spaces: CONTES_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    pawns.set({ id: 'contes', pawns: CONTES_PAWNS }),
    ...cardSchema.components,
  ],
  resourceIds: Object.values(CONTES_RESOURCES),
  initialization: { firstPlayer: 'random', startRound: true },
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  setup: setupGame,
  initialPhase: CONTES_PHASES.initialPhase,
  phases: CONTES_PHASES.phases,
  actions: CONTES_ACTIONS,
  effects: CONTES_EFFECTS,
  ...GAME_RULES,

  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
