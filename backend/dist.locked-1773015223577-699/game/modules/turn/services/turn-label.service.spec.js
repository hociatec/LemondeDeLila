"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _turnlabelservice = require("./turn-label.service");
describe('TurnLabelService', ()=>{
    let service;
    beforeEach(()=>{
        service = new _turnlabelservice.TurnLabelService();
    });
    function createState(partial) {
        return {
            status: 'started',
            phase: 'main',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [],
            turn: {
                currentPlayerId: null,
                direction: 1
            },
            ...partial
        };
    }
    it('sanitizes zone suffix in current player label', ()=>{
        const state = createState({
            players: [
                {
                    id: 7,
                    username: 'Garfield (zone de jeu)'
                }
            ],
            turn: {
                currentPlayerId: 7,
                direction: 1
            }
        });
        expect(service.compute(state, 'lama')).toBe("C'est à Garfield de jouer.");
    });
    it('sanitizes zone suffix when using turnIndex fallback', ()=>{
        const state = createState({
            turn: {
                currentPlayerId: null,
                direction: 1
            },
            turnIndex: 0,
            players: [
                {
                    id: 3,
                    username: 'Olaf (game zone)'
                }
            ]
        });
        expect(service.compute(state, 'jeu-oie')).toBe("C'est à Olaf de jouer.");
    });
    it('keeps numeric fallback when sanitized username is empty', ()=>{
        const state = createState({
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            players: [
                {
                    id: 2,
                    username: '   '
                }
            ]
        });
        expect(service.compute(state, 'lama')).toBe("C'est à Joueur 2 de jouer.");
    });
    it('resolves username when player ids are serialized as strings', ()=>{
        const state = createState({
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            players: [
                {
                    id: '2',
                    username: 'Nina'
                }
            ]
        });
        expect(service.compute(state, 'lama')).toBe("C'est à Nina de jouer.");
    });
    it('forces generic pawn prompt during pawn selection', ()=>{
        const state = createState({
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            players: [
                {
                    id: 2,
                    username: 'Olaf'
                }
            ],
            pending: {
                type: 'pick_pawn',
                playerId: 2,
                label: "C'est à Olaf de choisir son pion, puis Entrée."
            }
        });
        expect(service.compute(state, 'en-attendant-minuit')).toBe("C'est à Olaf de choisir son pion.");
    });
    it('uses pending.playerId for generic pawn prompt when turn points elsewhere', ()=>{
        const state = createState({
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'Lila'
                },
                {
                    id: 2,
                    username: 'Olaf'
                }
            ],
            pending: {
                type: 'choose_pawn',
                playerId: 2,
                label: 'Texte spécifique jeu'
            }
        });
        expect(service.compute(state, 'jeu-oie')).toBe("C'est à Olaf de choisir son pion.");
    });
});
