"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ExchangeService", {
    enumerable: true,
    get: function() {
        return ExchangeService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let ExchangeService = class ExchangeService {
    getOverview() {
        return {
            id: 'exchange',
            label: 'Échange',
            description: 'Mécanismes d’échange entre joueurs (cartes, ressources, troc).',
            capabilities: [
                {
                    id: 'offers',
                    description: 'Création et validation d’offres d’échange.'
                },
                {
                    id: 'constraints',
                    description: 'Règles d’éligibilité et contraintes de jeu.'
                },
                {
                    id: 'resolution',
                    description: 'Application des échanges et mise à jour des inventaires.'
                }
            ]
        };
    }
};
ExchangeService = _ts_decorate([
    (0, _common.Injectable)()
], ExchangeService);
