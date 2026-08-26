import {
  cards,
  defineGame,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import { MAMAN_CONTENT } from './content';
import {
  MAMAN_EFFECTS,
  TOUT_PRES_DE_MAMAN_ACTIONS,
} from './rules';
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
  patterns: [raceGame({ trackId: 'forest', spaces: MAMAN_CONTENT.tiles.length })],
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
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('forest', player.id),
        ]),
    );
    const tokens = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.resources.get(player.id, 'eucalyptus'),
        ]),
    );
    const bonusReroll = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.status.has(player.id, 'maman.bonus-reroll'),
        ]),
    );
    return playerView({
      game: {
        tokens,
        bonusReroll,
        lastRoll: ctx.dice.last('main')?.total ?? null,
        positions,
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
        skipTurns: Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [player.id, ctx.turn.skipCount(player.id)]),
        ),
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
                .map(
                  (player) => `${player.username} : ${tokens[player.id]}`,
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
