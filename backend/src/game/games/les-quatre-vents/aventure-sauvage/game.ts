import {
  cards,
  defineCardsSchema,
  defineGame,
  pawns,
  raceGame,
} from '../../../engine/sdk/public-api';
import {
  AVENTURE_ANIMAL_CARDS,
  AVENTURE_GAME_CONTENT,
  AVENTURE_PATTE_CARDS,
  AVENTURE_PAWNS,
  AVENTURE_TILES,
} from './content';
import manifest from './manifest.json';
import { GAME_CHOICES, GAME_EFFECTS } from './rules';

import { AVENTURE_ACTIONS, AVENTURE_PHASES } from './rules';
import { setupGame } from './rules';
import type { AventureSauvageState } from './types';

const cardSchema = defineCardsSchema({
  decks: {
    animal: cards.deck({
      id: 'animal',
      cards: AVENTURE_ANIMAL_CARDS,
      shuffle: true,
    }),
    patte: cards.deck({
      id: 'patte',
      cards: AVENTURE_PATTE_CARDS,
      shuffle: true,
    }),
  },
  hands: {},
});

export default defineGame<AventureSauvageState>()({
  id: manifest.code,
  rulesVersion: '2',
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: AVENTURE_GAME_CONTENT,
  patterns: [
    raceGame({
      trackId: 'jungle',
      spaces: AVENTURE_TILES.length,
      winOnFinish: 'jungle-finish',
    }),
  ],
  components: [
    pawns.set({ id: 'avatars', pawns: AVENTURE_PAWNS }),
    ...cardSchema.components,
  ],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
  ],
  setup: setupGame,
  initialPhase: AVENTURE_PHASES.initialPhase,
  phases: AVENTURE_PHASES.phases,
  actions: AVENTURE_ACTIONS,
  effects: GAME_EFFECTS,
  choices: GAME_CHOICES,

  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
