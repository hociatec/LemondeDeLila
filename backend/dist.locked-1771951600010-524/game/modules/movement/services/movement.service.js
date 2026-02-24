"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementService = void 0;
const common_1 = require("@nestjs/common");
let MovementService = class MovementService {
    getOverview() {
        return {
            id: 'movement',
            label: 'Déplacement',
            description: 'Déplacements issus du dé ou d’effets, avec validation des limites du plateau.',
            capabilities: [
                {
                    id: 'dice',
                    description: 'Appliquer les résultats de dé sur le mouvement.',
                },
                {
                    id: 'effects',
                    description: 'Déplacements forcés (reculer, avancer, téléportation).',
                },
                {
                    id: 'bounds',
                    description: 'Validation des bords, cases spéciales et rebonds.',
                },
            ],
        };
    }
};
exports.MovementService = MovementService;
exports.MovementService = MovementService = __decorate([
    (0, common_1.Injectable)()
], MovementService);
//# sourceMappingURL=movement.service.js.map