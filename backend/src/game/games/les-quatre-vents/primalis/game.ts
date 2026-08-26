import {
  defineGame,
  diceKit,
  movement,
  playerView,
  standardTurn,
  victoryWhen,
} from '../../../core/application/public-api';
import { PRIMALIS_TILES } from './content';
import { PRIMALIS_ACTIONS, winnerByResources } from './rules';
import type {
  PrimalisPlayerView,
  PrimalisResources,
  PrimalisState,
} from './state';

const track = movement.track({ id: 'comet', spaces: PRIMALIS_TILES.length });

export default defineGame<
  PrimalisState,
  typeof PRIMALIS_ACTIONS,
  PrimalisPlayerView
>({
  id: 'primalis',
  displayName: 'Primalis',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Construisez votre tribu avant l’impact de la comète.',
  players: { min: 2, max: 6 },
  components: [track, diceKit({ id: 'main', count: 1, sides: 6 })],
  shortcuts: [
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
    { key: 'V', type: 'interface', id: 'ressources' },
  ],
  setup: ({ players }) => ({
    collections: Object.fromEntries(
      players.map((player) => [
        player.id,
        {
          herbivores: 2,
          carnivores: 0,
          eggs: 0,
          leaves: 2,
        } satisfies PrimalisResources,
      ]),
    ),
    dangerAmplified: false,
    lastRoll: null,
    lastFace: null,
  }),
  turn: standardTurn(),
  actions: PRIMALIS_ACTIONS,
  victory: victoryWhen(({ state, ctx }) => {
    const finished = ctx.players
      .all()
      .some(
        (player) =>
          ctx.movement.position('comet', player.id) >=
          PRIMALIS_TILES.length - 1,
      );
    const winnerId = finished ? winnerByResources(state.collections) : null;
    return winnerId == null
      ? null
      : { winnerPlayerIds: [winnerId], reason: 'comet-impact' };
  }),
  view: ({ state, actor, ctx }) => {
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('comet', player.id),
        ]),
    );
    const mine = actor ? state.collections[actor.id] : null;
    const scoreLines = ctx.players
      .all()
      .map(
        (player) =>
          `${player.username}: ${winnerByResources({ [player.id]: state.collections[player.id] }) == null ? 0 : state.collections[player.id].herbivores + state.collections[player.id].carnivores + state.collections[player.id].leaves}`,
      );
    return playerView({
      game: { ...structuredClone(state), positions },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        ui: {
          panels: {
            ressources: {
              title: 'Tribu',
              message: mine
                ? `Herbivores: ${mine.herbivores} | Carnivores: ${mine.carnivores} | Œufs: ${mine.eggs} | Feuilles: ${mine.leaves}`
                : '',
            },
            score: { title: 'Score', message: scoreLines.join('\n') },
          },
        },
      },
      board: { tiles: structuredClone(PRIMALIS_TILES), positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
