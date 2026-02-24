"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardsService = void 0;
const common_1 = require("@nestjs/common");
let CardsService = class CardsService {
    getOverview() {
        return {
            id: 'cards',
            label: 'Cartes',
            description: 'Gestion des paquets : pioche, mélange, défausse et multi-types de cartes.',
            capabilities: [
                {
                    id: 'decks',
                    description: 'Création et configuration de paquets multiples.',
                },
                {
                    id: 'draw-discard',
                    description: 'Pioche, défausse et remise en jeu.',
                },
                {
                    id: 'shuffling',
                    description: 'Mélange et randomisation configurables.',
                },
            ],
        };
    }
};
exports.CardsService = CardsService;
exports.CardsService = CardsService = __decorate([
    (0, common_1.Injectable)()
], CardsService);
//# sourceMappingURL=cards.service.js.map