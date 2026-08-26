import {
  defineGame,
  playerView,
  raceGame,
  victoryWhen,
} from '../../../core/application/public-api';
import { PRIMALIS_TILES } from './content';
import {
  faceFromRoll,
  primalisCollections,
  PRIMALIS_ACTIONS,
  PRIMALIS_DANGER_AMPLIFIED,
  winnerByResources,
} from './rules';
import type { PrimalisPlayerView, PrimalisState } from './state';

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
  patterns: [raceGame({ trackId: 'comet', spaces: PRIMALIS_TILES.length })],
  initialization: {
    resources: {
      herbivores: 2,
      carnivores: 0,
      eggs: 0,
      leaves: 2,
    },
    counters: { [PRIMALIS_DANGER_AMPLIFIED]: 0 },
    startRound: false,
  },
  shortcuts: [
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
    { key: 'V', type: 'interface', id: 'ressources' },
  ],
  setup: () => ({}),
  actions: PRIMALIS_ACTIONS,
  victory: victoryWhen(({ state: _state, ctx }) => {
    const finished = ctx.players
      .all()
      .some(
        (player) =>
          ctx.movement.position('comet', player.id) >=
          PRIMALIS_TILES.length - 1,
      );
    const winnerId = finished
      ? winnerByResources(primalisCollections(ctx))
      : null;
    return winnerId == null
      ? null
      : { winnerPlayerIds: [winnerId], reason: 'comet-impact' };
  }),
  view: ({ state: _state, actor, ctx }) => {
    const collections = primalisCollections(ctx);
    const lastRoll = ctx.dice.last('main')?.total ?? null;
    const lastFace = lastRoll == null ? null : faceFromRoll(lastRoll);
    const positions = ctx.players.byId((player) =>
      ctx.movement.position('comet', player.id),
    );
    const mine = actor ? collections[actor.id] : null;
    const scoreLines = ctx.players
      .all()
      .map(
        (player) =>
          `${player.username}: ${collections[player.id].herbivores + collections[player.id].carnivores + collections[player.id].leaves}`,
      );
    return playerView({
      game: {
        dangerAmplified: ctx.counters.get(PRIMALIS_DANGER_AMPLIFIED) > 0,
        collections,
        lastFace,
      },
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
      board: { tiles: PRIMALIS_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
