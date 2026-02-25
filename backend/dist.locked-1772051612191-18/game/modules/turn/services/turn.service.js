"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TurnService", {
    enumerable: true,
    get: function() {
        return TurnService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let TurnService = class TurnService {
    getOverview() {
        return {
            id: 'turn',
            label: 'Tour de jeu',
            description: 'Gestion de l’ordre des joueurs, sens de rotation et sauts de tour.',
            capabilities: [
                {
                    id: 'order',
                    description: 'Suivi de l’ordre des joueurs et du joueur courant.'
                },
                {
                    id: 'direction',
                    description: 'Sens horaire/anti-horaire et inversions.'
                },
                {
                    id: 'skip',
                    description: 'Perte de tour et pénalités temporelles.'
                }
            ]
        };
    }
    nextTurn(players, currentIndex, skipTurn) {
        if (!players.length) {
            return {
                turnIndex: currentIndex,
                currentPlayerId: -1,
                skipTurn
            };
        }
        let nextIndex = currentIndex;
        let attempts = 0;
        const updatedSkip = {
            ...skipTurn
        };
        const skipped = [];
        const totalSkips = Object.values(skipTurn).reduce((sum, value)=>sum + Math.max(0, value ?? 0), 0);
        const maxAttempts = players.length + totalSkips;
        do {
            nextIndex = (nextIndex + 1) % players.length;
            const pid = players[nextIndex].id;
            const remaining = updatedSkip[pid] ?? 0;
            if (remaining > 0) {
                const remainingAfter = remaining - 1;
                updatedSkip[pid] = remainingAfter;
                skipped.push({
                    id: pid,
                    remainingBefore: remaining,
                    remainingAfter
                });
                attempts += 1;
                continue;
            }
            break;
        }while (attempts < maxAttempts)
        return {
            turnIndex: nextIndex,
            currentPlayerId: players[nextIndex].id,
            skipTurn: updatedSkip,
            ...skipped.length ? {
                skipped
            } : {}
        };
    }
};
TurnService = _ts_decorate([
    (0, _common.Injectable)()
], TurnService);
