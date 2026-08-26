import {
  cards,
  defineGame,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import { MAMAN_CONTENT } from './content';
import { MAMAN_EFFECTS, TOUT_PRES_DE_MAMAN_ACTIONS } from './rules';
import type { ToutPresDeMamanPlayerView, ToutPresDeMamanState } from './state';

const deck = cards.deck({
  id: 'events',
  cards: MAMAN_CONTENT.cards,
  shuffle: true,
  empty: 'recycle',
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
  setup: () => ({}),
  actions: TOUT_PRES_DE_MAMAN_ACTIONS,
  effects: MAMAN_EFFECTS,
  view: ({ actor, ctx }) => {
    const positions = ctx.players.byId((player) =>
      ctx.movement.position('forest', player.id),
    );
    const tokens = ctx.players.byId((player) =>
      ctx.resources.get(player.id, 'eucalyptus'),
    );
    const bonusReroll = ctx.players.byId((player) =>
      ctx.status.has(player.id, 'maman.bonus-reroll'),
    );
    return playerView({
      game: {
        tokens,
        bonusReroll,
      },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        tokens: structuredClone(tokens),
        ui: {
          panels: [
            {
              title: 'Eucalyptus',
              lines: ctx.players
                .all()
                .map((player) => `${player.username} : ${tokens[player.id]}`),
            },
          ],
        },
      },
      board: { tiles: MAMAN_CONTENT.tiles, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
