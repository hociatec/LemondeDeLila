import {
  cards,
  defineCardsSchema,
  defineGame,
  ownership,
  raceGame,
} from '../../../engine/sdk/public-api';
import { SAC_ACTIONS } from './actions';
import { GAME_BOT } from './bot-rules';
import {
  GAME_CONFIGURATION,
  SAC_PHASES,
  VARIANT_SELECTED,
} from './configuration';
import { SAC_GAME_CONTENT, SAC_VARIANTS } from './content';
import { SAC_JAIL_CARDS, SAC_POT } from './economy';
import { SAC_EFFECTS } from './effects';
import manifest from './manifest.json';
import { GAME_RULES } from './rule-bindings';
import type { SacState } from './state';

const cardSchema = defineCardsSchema({
  decks: Object.fromEntries(
    SAC_VARIANTS.flatMap((variant) =>
      (['chance', 'community'] as const).map((kind) => {
        const id = `${kind}:${variant.id}`;
        return [
          id,
          cards.deck({
            id,
            cards: variant[kind],
            shuffle: true,
            empty: 'recycle',
          }),
        ];
      }),
    ),
  ),
  hands: {},
});

export default defineGame<SacState>()({
  rulesVersion: '2',
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  events: [VARIANT_SELECTED],
  content: SAC_GAME_CONTENT,
  config: GAME_CONFIGURATION,
  patterns: [
    raceGame({
      trackId: 'city',
      spaces: 40,
      diceId: 'pair',
      diceCount: 2,
    }),
  ],
  components: [
    ownership.registry({
      id: 'properties',
      assets: [
        ...new Set(
          SAC_VARIANTS.flatMap((variant) =>
            variant.tiles.map((tile) => tile.id),
          ),
        ),
      ],
      visibility: 'public',
    }),
    ...cardSchema.components,
  ],
  resourceIds: ['money', SAC_JAIL_CARDS],
  initialization: { counters: { [SAC_POT]: 0 }, startRound: false },
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  setup: () => ({ buildings: {} }),
  initialPhase: SAC_PHASES.initialPhase,
  phases: SAC_PHASES.phases,
  actions: SAC_ACTIONS,
  effects: SAC_EFFECTS,
  ...GAME_RULES,

  bot: GAME_BOT,
});
