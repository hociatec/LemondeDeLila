import {
  cards,
  defineGame,
  defineGameContent,
  raceGame,
} from '../../../engine/sdk/public-api';
import { MAMAN_CONTENT } from './content';
import { MAMAN_EFFECTS, TOUT_PRES_DE_MAMAN_ACTIONS } from './rules';
import type { ToutPresDeMamanState } from './types';

const deck = cards.deck({
  id: 'events',
  cards: MAMAN_CONTENT.cards,
  shuffle: true,
  empty: 'recycle',
});

export default defineGame<ToutPresDeMamanState>()({
  id: 'tout-pres-de-maman',
  displayName: 'Tout près de Maman !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Collectez les eucalyptus et retrouvez maman.',
  players: { min: 2, max: 6 },
  content: defineGameContent('tout-pres-de-maman', MAMAN_CONTENT),
  patterns: [
    raceGame({ trackId: 'forest', spaces: MAMAN_CONTENT.tiles.length }),
  ],
  components: [deck],
  initialization: { resources: { eucalyptus: 2 }, startRound: false },
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  actions: TOUT_PRES_DE_MAMAN_ACTIONS,
  effects: MAMAN_EFFECTS,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
