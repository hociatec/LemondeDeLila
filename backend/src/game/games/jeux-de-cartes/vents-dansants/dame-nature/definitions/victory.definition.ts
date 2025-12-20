import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { VictoryCondition } from '../../../../../modules/victory/services/victory.service';
import { DameNatureMetadata } from '../services/dame-nature.service';

// Conditions de victoire déclaratives pour Dame Nature.
// Variante simple : atteindre le seuil de livres terminés ou éviter la pollution max.
export const DAME_NATURE_VICTORY: VictoryCondition[] = [
  {
    id: 'books-goal',
    description:
      "Atteindre l'objectif de familles complétées avant la pollution max.",
    check: (state: GameStateEntity) => {
      const meta = state.metadata as DameNatureMetadata | undefined;
      if (!meta) return false;
      const players = state.players ?? [];
      const totalBooks = players.reduce(
        (acc, p) => acc + ((p as any).books?.length ?? 0),
        0,
      );
      if (totalBooks >= meta.familyGoal) {
        return {
          finished: true,
          winnerId: 'cooperative',
          details: { totalBooks },
        };
      }
      return false;
    },
  },
  {
    id: 'pollution-max',
    description: 'La pollution atteint le seuil critique.',
    check: (state: GameStateEntity) => {
      const meta = state.metadata as DameNatureMetadata | undefined;
      if (!meta) return false;
      const pollutions = Object.values(meta.pollutionByPlayer ?? {}).filter(
        (v) => typeof v === 'number',
      );
      const worst = pollutions.length ? Math.max(...pollutions) : 0;
      if (worst >= meta.maxPollution) {
        return {
          finished: true,
          winnerId: null,
          details: { pollution: worst },
        };
      }
      return false;
    },
  },
];
