import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { VictoryCondition } from '../../../../modules/victory/services/victory.service';

// Conditions de victoire declaratives pour Panier Express.
// Victoire des qu'un joueur complete sa liste dans son panier ET revient pile sur la case depart.
export const PANIER_EXPRESS_VICTORY: VictoryCondition[] = [
  {
    id: 'shopping-complete',
    description: 'Liste de courses complete + retour pile sur la case depart.',
    check: (state: GameStateEntity) => {
      const players = state.players ?? [];
      const positions =
        (state.metadata as any)?.positions &&
        typeof (state.metadata as any).positions === 'object'
          ? (state.metadata as any).positions
          : {};

      for (const player of players) {
        const shoppingList = Array.isArray((player as any).shoppingList)
          ? (player as any).shoppingList
          : [];
        const basket = Array.isArray((player as any).basket)
          ? (player as any).basket
          : [];
        const completed =
          shoppingList.length > 0 &&
          shoppingList.every((item) => basket.includes(item));

        const pos =
          typeof positions?.[player.id] === 'number' ? positions[player.id] : -1;
        const atStart = pos === 0;

        if (completed && atStart) {
          return {
            finished: true,
            winnerId: player.id,
            details: { basketSize: basket.length, position: pos },
          };
        }
      }

      return false;
    },
  },
];
