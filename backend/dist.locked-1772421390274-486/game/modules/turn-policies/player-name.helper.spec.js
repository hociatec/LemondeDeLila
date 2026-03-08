"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _playernamehelper = require("./player-name.helper");
describe('player-name.helper', ()=>{
    it('returns the player username when id matches', ()=>{
        const out = (0, _playernamehelper.resolvePlayerName)([
            {
                id: 7,
                username: 'Lila'
            }
        ], 7);
        expect(out).toBe('Lila');
    });
    it('supports numeric-id coercion for serialized ids', ()=>{
        const out = (0, _playernamehelper.resolvePlayerName)([
            {
                id: '7',
                username: 'Lila'
            }
        ], 7, {
            coerceNumericIds: true
        });
        expect(out).toBe('Lila');
    });
    it('sanitizes whitespace and wrapping double quotes when requested', ()=>{
        const out = (0, _playernamehelper.resolvePlayerName)([
            {
                id: 3,
                username: '  "Lila   (zone de jeu)"  '
            }
        ], 3, {
            collapseWhitespace: true,
            unwrapDoubleQuotes: true
        });
        expect(out).toBe('Lila (zone de jeu)');
    });
    it('falls back to Joueur {id} when user is missing', ()=>{
        const out = (0, _playernamehelper.resolvePlayerName)([], 42);
        expect(out).toBe('Joueur 42');
    });
    it('resolves from state wrapper', ()=>{
        const out = (0, _playernamehelper.resolvePlayerNameFromState)({
            players: [
                {
                    id: 2,
                    username: 'Nina'
                }
            ]
        }, 2);
        expect(out).toBe('Nina');
    });
});
