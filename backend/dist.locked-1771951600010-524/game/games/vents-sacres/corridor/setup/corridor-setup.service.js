"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorridorSetupService = void 0;
const common_1 = require("@nestjs/common");
const game_definition_1 = require("../definitions/game.definition");
let CorridorSetupService = class CorridorSetupService {
    hydrateInitialState(baseState) {
        const status = String(baseState.status ?? '')
            .toLowerCase()
            .trim();
        if (status !== 'started') {
            return {
                ...baseState,
                metadata: {
                    ...(baseState.metadata ?? {}),
                    size: game_definition_1.CORRIDOR_GAME.boardSize,
                    winnerPlayerId: null,
                },
            };
        }
        const players = baseState.players ?? [];
        if (players.length < game_definition_1.CORRIDOR_GAME.minPlayers) {
            throw new Error('Nombre de joueurs insuffisant pour dǸmarrer Le Corridor.');
        }
        const size = game_definition_1.CORRIDOR_GAME.boardSize;
        const p1 = players[0];
        const p2 = players[1];
        const startX = Math.floor(size / 2);
        const metadata = {
            size,
            pawnsByPlayerId: {
                [String(p1.id)]: { x: startX, y: 0 },
                [String(p2.id)]: { x: startX, y: size - 1 },
            },
            walls: { h: [], v: [] },
            wallsRemainingByPlayerId: {
                [String(p1.id)]: game_definition_1.CORRIDOR_GAME.wallsPerPlayer,
                [String(p2.id)]: game_definition_1.CORRIDOR_GAME.wallsPerPlayer,
            },
            winnerPlayerId: null,
        };
        return {
            ...baseState,
            phase: 'play',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            metadata: { ...(baseState.metadata ?? {}), ...metadata },
            pending: null,
            log: [...(baseState.log ?? []), { message: 'Le Corridor dǸmarre.' }],
            turn: {
                currentPlayerId: p1.id,
                direction: 1,
                label: `Tour de ${p1.username}`,
            },
        };
    }
};
exports.CorridorSetupService = CorridorSetupService;
exports.CorridorSetupService = CorridorSetupService = __decorate([
    (0, common_1.Injectable)()
], CorridorSetupService);
//# sourceMappingURL=corridor-setup.service.js.map