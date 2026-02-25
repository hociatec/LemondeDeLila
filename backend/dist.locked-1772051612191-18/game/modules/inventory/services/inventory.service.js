"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "InventoryService", {
    enumerable: true,
    get: function() {
        return InventoryService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let InventoryService = class InventoryService {
    getOverview() {
        return {
            id: 'inventory',
            label: 'Inventaire',
            description: 'Suivi des possessions des joueurs (cartes, ressources, statuts).',
            capabilities: [
                {
                    id: 'items',
                    description: 'Gestion des éléments détenus (ajout/retrait).'
                },
                {
                    id: 'lists',
                    description: 'Listes d’objectifs ou collections à compléter.'
                },
                {
                    id: 'statuses',
                    description: 'États temporaires (perte de tour, bonus).'
                }
            ]
        };
    }
};
InventoryService = _ts_decorate([
    (0, _common.Injectable)()
], InventoryService);
