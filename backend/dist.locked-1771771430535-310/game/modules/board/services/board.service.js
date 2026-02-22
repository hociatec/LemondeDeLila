"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoardService = void 0;
const common_1 = require("@nestjs/common");
let BoardService = class BoardService {
    getOverview() {
        return {
            id: 'board',
            label: 'Plateau',
            description: 'Gestion des cases, positions, déplacements et validation des chemins.',
            capabilities: [
                {
                    id: 'grid',
                    description: 'Représentation du plateau (cases, types, liens).',
                },
                { id: 'position', description: 'Coordonnées des joueurs et entités.' },
                {
                    id: 'movement',
                    description: 'Calcul des déplacements et validation des règles de parcours.',
                },
            ],
        };
    }
};
exports.BoardService = BoardService;
exports.BoardService = BoardService = __decorate([
    (0, common_1.Injectable)()
], BoardService);
//# sourceMappingURL=board.service.js.map