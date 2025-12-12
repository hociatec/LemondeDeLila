import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { VictoryCondition } from '../../../../../modules/victory/services/victory.service';
import { PanierExpressMetadata } from '../entities/panier-express-state.entity';

// Conditions de victoire déclaratives pour Panier Express.
// Ici simplifié : avoir complété sa liste et être sur la case start.
export const PANIER_EXPRESS_VICTORY: VictoryCondition[] = [
  {
    id: 'shopping-complete',
    description: 'Liste de courses complète et retour à la case départ.',
    check: (state: GameStateEntity) => {
      const meta = state.metadata as PanierExpressMetadata | undefined;
      if (!meta) return false;
      const players = state.players ?? [];
      for (const player of players) {
        const pos = meta.positions[player.id] ?? 0;
        const tile = meta.tiles[pos];
        if (!tile || tile.type !== 'start') continue;
        const shoppingList = Array.isArray((player as any).shoppingList) ? (player as any).shoppingList : [];
        const basket = Array.isArray((player as any).basket) ? (player as any).basket : [];
        const completed = shoppingList.length > 0 && shoppingList.every((item) => basket.includes(item));
        if (completed) {
          return { finished: true, winnerId: player.id, details: { tile: tile.id } };
        }
      }
      return false;
    },
  },
];
