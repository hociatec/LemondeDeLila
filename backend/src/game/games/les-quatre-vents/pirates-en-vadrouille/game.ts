import {
  cards,
  collection,
  defineEffect,
  defineGame,
  defineGameContent,
  gameInput,
  inventory,
  raceGame,
} from '../../../engine/sdk/public-api';
import { PIRATES_CONTENT } from './content';
import { PIRATES_ACTIONS, stealTreasure } from './rules';
import type { PiratesState } from './state';

const cardDecks = (['treasure', 'obstacle', 'bonus'] as const).map((id) =>
  cards.deck({ id, cards: PIRATES_CONTENT[id], shuffle: true }),
);

export default defineGame<PiratesState, typeof PIRATES_ACTIONS>({
  id: 'pirates-en-vadrouille',
  displayName: 'Pirates en vadrouille !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Explorez Papayousse et ouvrez son coffre légendaire.',
  players: { min: 2, max: 6 },
  content: defineGameContent('pirates-en-vadrouille', PIRATES_CONTENT),
  patterns: [
    raceGame({ trackId: 'island', spaces: PIRATES_CONTENT.tiles.length }),
  ],
  components: [
    ...cardDecks,
    ...(['treasure', 'obstacle', 'bonus'] as const).map((kind) =>
      inventory.set({
        id: `pirates-${kind}`,
        items: PIRATES_CONTENT[kind].map((card) => String(card.id)),
        visibility: 'public',
      }),
    ),
    collection.view({
      id: 'pirate-loot',
      groups: {
        treasures: { kind: 'inventory', id: 'pirates-treasure' },
        obstacles: { kind: 'inventory', id: 'pirates-obstacle' },
        bonus: { kind: 'inventory', id: 'pirates-bonus' },
        gold: { kind: 'resource', id: 'pirate-gold' },
      },
    }),
  ],
  initialization: {
    resources: { 'pirate-gold': 0 },
    startRound: false,
  },
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  actions: PIRATES_ACTIONS,
  effects: {
    'pirates.steal-treasure': defineEffect<PiratesState, Record<string, never>>(
      {
        input: gameInput.object({}),
        apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
          const targetId = targetPlayerIds[0];
          if (actorPlayerId != null && targetId != null) {
            stealTreasure(actorPlayerId, targetId, ctx);
          }
        },
      },
    ),
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
