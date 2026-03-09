"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _lamasharedservice = require("../shared/lama-shared.service");
describe('LamaSharedService', ()=>{
    it('strips game-zone suffix from player labels', ()=>{
        const shared = new _lamasharedservice.LamaSharedService();
        expect(shared.sanitizePlayerName('Garfield (zone de jeu)')).toBe('Garfield');
        expect(shared.sanitizePlayerName('Garfield (zone de jeux)')).toBe('Garfield');
        expect(shared.sanitizePlayerName('Garfield (game zone)')).toBe('Garfield');
    });
    it('uses sanitized names in playerLabel', ()=>{
        const shared = new _lamasharedservice.LamaSharedService();
        const players = [
            {
                id: 2,
                username: 'Garfield (zone de jeu)'
            }
        ];
        expect(shared.playerLabel(players, 2)).toBe('Garfield');
    });
});
