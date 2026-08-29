import {
  defineGame,
  defineGameContent,
  raceGame,
  victoryWhen,
} from '../../../engine/sdk/public-api';
import { PRIMALIS_TILES } from './content';
import {
  primalisCollections,
  PRIMALIS_ACTIONS,
  PRIMALIS_DANGER_AMPLIFIED,
  winnerByResources,
} from './rules';
import type { PrimalisState } from './types';

export default defineGame<PrimalisState, typeof PRIMALIS_ACTIONS>({
  id: 'primalis',
  displayName: 'Primalis',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Construisez votre tribu avant l’impact de la comète.',
  players: { min: 2, max: 6 },
  content: defineGameContent('primalis', { tiles: PRIMALIS_TILES }),
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
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
