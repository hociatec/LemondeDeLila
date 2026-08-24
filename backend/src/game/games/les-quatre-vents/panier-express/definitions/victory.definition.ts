import { GameStateEntity } from '../../../../application/models/game-state.model';
import { VictoryCondition } from '../../../../application/features/victory/services/victory.service';
import type {
  PanierExpressMetadata,
  PanierExpressPlayer,
} from '../model/panier-express-state.model';

// Conditions de victoire declaratives pour Panier Express.
// Victoire des qu'un joueur complete sa liste dans son panier ET revient pile sur la case depart.
export const PANIER_EXPRESS_VICTORY: VictoryCondition[] = [
  {
    id: 'shopping-complete',
    description: 'Liste de courses complete + retour pile sur la case depart.',
    check: (state: GameStateEntity) => {
      const players = (state.players ?? []) as PanierExpressPlayer[];
      const meta = state.metadata as Partial<PanierExpressMetadata> | null;
      const positions =
        meta?.positions && typeof meta.positions === 'object'
          ? meta.positions
          : {};

      for (const player of players) {
        const shoppingList = Array.isArray(player.shoppingList)
          ? player.shoppingList
          : [];
        const basket = Array.isArray(player.basket) ? player.basket : [];
        const completed =
          shoppingList.length > 0 &&
          shoppingList.every((item) => basket.includes(item));

        const pos =
          typeof positions?.[player.id] === 'number'
            ? positions[player.id]
            : -1;
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





