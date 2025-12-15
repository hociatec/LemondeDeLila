import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { VictoryCondition } from '../../../../../modules/victory/services/victory.service';

// Conditions de victoire déclaratives pour Panier Express.
// Victoire dès qu'un joueur complète sa liste dans son panier.
export const PANIER_EXPRESS_VICTORY: VictoryCondition[] = [
  {
    id: 'shopping-complete',
    description: 'Liste de courses complète (dans le panier).',
    check: (state: GameStateEntity) => {
      const players = state.players ?? [];
      for (const player of players) {
        const shoppingList = Array.isArray((player as any).shoppingList) ? (player as any).shoppingList : [];
        const basket = Array.isArray((player as any).basket) ? (player as any).basket : [];
        const completed = shoppingList.length > 0 && shoppingList.every((item) => basket.includes(item));
        if (completed) {
          return { finished: true, winnerId: player.id, details: { basketSize: basket.length } };
        }
      }
      return false;
    },
  },
];
