"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "EffectsService", {
    enumerable: true,
    get: function() {
        return EffectsService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let EffectsService = class EffectsService {
    getOverview() {
        return {
            id: 'effects',
            label: 'Effets',
            description: 'Conséquences génériques appliquées au jeu.',
            capabilities: [
                {
                    id: 'draw',
                    description: 'Piocher des cartes dans un paquet donné.'
                },
                {
                    id: 'skip',
                    description: 'Perdre ou gagner un tour.'
                },
                {
                    id: 'move',
                    description: 'Reculer/avancer de cases ou se déplacer vers une case cible.'
                }
            ]
        };
    }
};
EffectsService = _ts_decorate([
    (0, _common.Injectable)()
], EffectsService);
