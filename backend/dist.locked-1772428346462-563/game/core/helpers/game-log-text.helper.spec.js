"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _gamelogtexthelper = require("./game-log-text.helper");
describe('game-log-text.helper', ()=>{
    it('formats turn announcement', ()=>{
        expect((0, _gamelogtexthelper.turnAnnouncement)('Lila')).toBe("C'est au tour de Lila.");
    });
    it('formats pawn placement', ()=>{
        expect((0, _gamelogtexthelper.pawnPlacement)({
            playerLabel: 'Lila',
            pawnLabel: 'sa montgolfiere',
            position: 2,
            tileLabel: 'Case 3 - Foret'
        })).toBe('Lila place sa montgolfiere en case 3 (Case 3 - Foret).');
    });
    it('formats dice roll', ()=>{
        expect((0, _gamelogtexthelper.diceRoll)({
            playerLabel: 'Lila',
            value: 4
        })).toBe('Lila lance un dé (4/6).');
        expect((0, _gamelogtexthelper.diceRoll)({
            playerLabel: 'Lila',
            value: 2,
            sides: 8
        })).toBe('Lila lance un dé (2/8).');
    });
    it('formats victory announcement', ()=>{
        expect((0, _gamelogtexthelper.victoryAnnouncement)('Lila')).toBe('Victoire de Lila.');
    });
});
