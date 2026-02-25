"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CorridorSetupService", {
    enumerable: true,
    get: function() {
        return CorridorSetupService;
    }
});
const _common = require("@nestjs/common");
const _gamedefinition = require("../definitions/game.definition");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let CorridorSetupService = class CorridorSetupService {
    hydrateInitialState(baseState) {
        const status = String(baseState.status ?? '').toLowerCase().trim();
        if (status !== 'started') {
            // En "setup" (table non démarrée), ne pas auto-démarrer une partie :
            // le moteur reconstruira l'état quand la room passera en "started".
            return {
                ...baseState,
                metadata: {
                    ...baseState.metadata ?? {},
                    size: _gamedefinition.CORRIDOR_GAME.boardSize,
                    winnerPlayerId: null
                }
            };
        }
        const players = baseState.players ?? [];
        if (players.length < _gamedefinition.CORRIDOR_GAME.minPlayers) {
            throw new Error('Nombre de joueurs insuffisant pour dǸmarrer Le Corridor.');
        }
        const size = _gamedefinition.CORRIDOR_GAME.boardSize;
        const p1 = players[0];
        const p2 = players[1];
        const startX = Math.floor(size / 2);
        const metadata = {
            size,
            pawnsByPlayerId: {
                [String(p1.id)]: {
                    x: startX,
                    y: 0
                },
                [String(p2.id)]: {
                    x: startX,
                    y: size - 1
                }
            },
            walls: {
                h: [],
                v: []
            },
            wallsRemainingByPlayerId: {
                [String(p1.id)]: _gamedefinition.CORRIDOR_GAME.wallsPerPlayer,
                [String(p2.id)]: _gamedefinition.CORRIDOR_GAME.wallsPerPlayer
            },
            winnerPlayerId: null
        };
        return {
            ...baseState,
            phase: 'play',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            metadata: {
                ...baseState.metadata ?? {},
                ...metadata
            },
            pending: null,
            log: [
                ...baseState.log ?? [],
                {
                    message: 'Le Corridor dǸmarre.'
                }
            ],
            turn: {
                currentPlayerId: p1.id,
                direction: 1,
                label: `Tour de ${p1.username}`
            }
        };
    }
};
CorridorSetupService = _ts_decorate([
    (0, _common.Injectable)()
], CorridorSetupService);
