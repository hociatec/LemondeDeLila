import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { VictoryCondition } from '../../../../../modules/victory/services/victory.service';

// Conditions de victoire Loup Garou (déclaratif).
export const LOUP_GAROU_VICTORY: VictoryCondition[] = [
  {
    id: 'lovers',
    description: 'Les amoureux survivent seuls.',
    check: (state: GameStateEntity) => {
      const meta = state.metadata as any;
      const lovers = meta?.lovers as [number, number] | null;
      if (!lovers) return false;
      const living = (state.players ?? [])
        .filter((p) => (p as any).alive !== false)
        .map((p) => p.id)
        .filter((id) => typeof id === 'number');
      const aliveLovers = lovers.filter((id) => living.includes(id));
      if (aliveLovers.length === 2 && living.length === 2) {
        return { finished: true, winnerId: 'lovers', details: { survivors: living } };
      }
      return false;
    },
  },
  {
    id: 'village',
    description: 'Les loups sont éliminés.',
    check: (state: GameStateEntity) => {
      const meta = state.metadata as any;
      const living = (state.players ?? [])
        .filter((p) => (p as any).alive !== false)
        .map((p) => p.id)
        .filter((id) => typeof id === 'number');
      const wolves = living.filter((id) => meta?.roles?.[id] === 'werewolf');
      if ((wolves?.length ?? 0) === 0 && living.length > 0) {
        return { finished: true, winnerId: 'village', details: { living } };
      }
      return false;
    },
  },
  {
    id: 'wolves',
    description: 'Les loups prennent le dessus.',
    check: (state: GameStateEntity) => {
      const meta = state.metadata as any;
      const living = (state.players ?? [])
        .filter((p) => (p as any).alive !== false)
        .map((p) => p.id)
        .filter((id) => typeof id === 'number');
      const wolves = living.filter((id) => meta?.roles?.[id] === 'werewolf');
      if (wolves.length > 0 && wolves.length >= living.length - wolves.length) {
        return { finished: true, winnerId: 'wolves', details: { living } };
      }
      return false;
    },
  },
];
