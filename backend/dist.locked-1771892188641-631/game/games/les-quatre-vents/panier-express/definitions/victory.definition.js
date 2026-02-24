"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PANIER_EXPRESS_VICTORY = void 0;
exports.PANIER_EXPRESS_VICTORY = [
    {
        id: 'shopping-complete',
        description: 'Liste de courses complete + retour pile sur la case depart.',
        check: (state) => {
            const players = state.players ?? [];
            const positions = state.metadata?.positions &&
                typeof state.metadata.positions === 'object'
                ? state.metadata.positions
                : {};
            for (const player of players) {
                const shoppingList = Array.isArray(player.shoppingList)
                    ? player.shoppingList
                    : [];
                const basket = Array.isArray(player.basket)
                    ? player.basket
                    : [];
                const completed = shoppingList.length > 0 &&
                    shoppingList.every((item) => basket.includes(item));
                const pos = typeof positions?.[player.id] === 'number'
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
//# sourceMappingURL=victory.definition.js.map