"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _gameerrors = require("../../../../../common/errors/game-errors");
const _rulebook = require("../rulebook/rulebook");
function makeState(overrides = {}) {
    return {
        status: 'started',
        phase: 'turn',
        round: 1,
        turnIndex: 0,
        lastRoll: null,
        log: [],
        players: [
            {
                id: 1,
                username: 'P1'
            },
            {
                id: 2,
                username: 'P2'
            }
        ],
        turn: {
            currentPlayerId: 1,
            direction: 1
        },
        metadata: {
            statuses: {
                blockedUntilPassed: {}
            }
        },
        pending: null,
        botThinking: false,
        ...overrides
    };
}
describe('Contes rulebook', ()=>{
    it('returns available actions for choose_option and choose_card pending states', ()=>{
        const optionActions = (0, _rulebook.getAvailableActions)(makeState({
            pending: {
                type: 'choose_option',
                playerId: 1,
                blocking: true,
                choices: [
                    'Avancer',
                    'Piocher'
                ]
            }
        }), 1);
        expect(optionActions).toEqual([
            {
                type: 'choose_option',
                payload: {
                    option: 'Avancer'
                }
            },
            {
                type: 'choose_option',
                payload: {
                    option: 'Piocher'
                }
            }
        ]);
        const cardActions = (0, _rulebook.getAvailableActions)(makeState({
            pending: {
                type: 'choose_card',
                playerId: 1,
                blocking: true,
                data: {
                    cards: [
                        {
                            cardType: 'bonus',
                            cardId: 10
                        },
                        {
                            cardType: 'surprise',
                            cardId: 22
                        }
                    ]
                }
            }
        }), 1);
        expect(cardActions).toEqual([
            {
                type: 'choose_card',
                payload: {
                    cardType: 'bonus',
                    cardId: 10
                }
            },
            {
                type: 'choose_card',
                payload: {
                    cardType: 'surprise',
                    cardId: 22
                }
            }
        ]);
    });
    it('returns empty actions when blocked or not current player', ()=>{
        const blocked = (0, _rulebook.getAvailableActions)(makeState({
            metadata: {
                statuses: {
                    blockedUntilPassed: {
                        1: 5
                    }
                }
            }
        }), 1);
        expect(blocked).toEqual([]);
        const notCurrent = (0, _rulebook.getAvailableActions)(makeState({
            turn: {
                currentPlayerId: 2,
                direction: 1
            }
        }), 1);
        expect(notCurrent).toEqual([]);
    });
    it('validates choose_card and rejects invalid choose_option payload', ()=>{
        const validated = (0, _rulebook.validateAction)(makeState({
            pending: {
                type: 'choose_card',
                playerId: 1,
                blocking: true,
                data: {
                    cards: [
                        {
                            cardType: 'bonus',
                            cardId: 7
                        }
                    ]
                }
            }
        }), {
            type: 'choose_card',
            payload: {
                cardType: 'bonus',
                cardId: 7
            }
        }, 1);
        expect(validated).toEqual({
            type: 'choose_card',
            payload: {
                cardType: 'bonus',
                cardId: 7
            }
        });
        expect(()=>(0, _rulebook.validateAction)(makeState({
                pending: {
                    type: 'choose_option',
                    playerId: 1,
                    blocking: true,
                    choices: [
                        'A',
                        'B'
                    ]
                }
            }), {
                type: 'choose_option',
                payload: {
                    option: 'Z'
                }
            }, 1)).toThrow(_gameerrors.GameValidationError);
    });
    it('rejects roll when actor is blocked or not on turn', ()=>{
        expect(()=>(0, _rulebook.validateAction)(makeState({
                metadata: {
                    statuses: {
                        blockedUntilPassed: {
                            1: 9
                        }
                    }
                }
            }), {
                type: 'roll',
                payload: {}
            }, 1)).toThrow(_gameerrors.PlayerActionError);
        expect(()=>(0, _rulebook.validateAction)(makeState({
                turn: {
                    currentPlayerId: 2,
                    direction: 1
                }
            }), {
                type: 'roll',
                payload: {}
            }, 1)).toThrow(_gameerrors.PlayerActionError);
    });
});
