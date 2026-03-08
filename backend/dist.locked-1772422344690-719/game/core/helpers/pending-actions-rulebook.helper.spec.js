"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _pendingactionsrulebookhelper = require("./pending-actions-rulebook.helper");
describe('pending-actions-rulebook.helper', ()=>{
    it('handles pending draw actions and validation', ()=>{
        const pending = {
            type: 'draw',
            playerId: '7'
        };
        expect((0, _pendingactionsrulebookhelper.getPendingDrawActionsForPlayer)(pending, 7, {
            samePlayer: (a, b)=>Number(a) === Number(b)
        })).toEqual([
            {
                type: 'draw',
                payload: {}
            }
        ]);
        expect((0, _pendingactionsrulebookhelper.validatePendingDrawActionForActor)({
            pending,
            actorId: 7,
            actionType: 'draw',
            samePlayer: (a, b)=>Number(a) === Number(b)
        })).toEqual({
            ok: true,
            action: {
                type: 'draw',
                payload: {}
            }
        });
        expect((0, _pendingactionsrulebookhelper.validatePendingDrawActionForActor)({
            pending,
            actorId: 7,
            actionType: 'roll',
            samePlayer: (a, b)=>Number(a) === Number(b)
        })).toEqual({
            ok: false,
            reason: 'wrong_action_type'
        });
    });
    it('handles pending choose_target actions and validation', ()=>{
        const pending = {
            type: 'choose_target',
            playerId: 2,
            data: {
                targets: [
                    {
                        targetPlayerId: 3
                    },
                    {
                        targetPlayerId: 5
                    }
                ]
            }
        };
        expect((0, _pendingactionsrulebookhelper.getPendingChooseTargetActionsForPlayer)(pending, 2)).toEqual([
            {
                type: 'choose_target',
                payload: {
                    targetPlayerId: 3
                }
            },
            {
                type: 'choose_target',
                payload: {
                    targetPlayerId: 5
                }
            }
        ]);
        expect((0, _pendingactionsrulebookhelper.validatePendingChooseTargetActionForActor)({
            pending,
            actorId: 2,
            actionType: 'choose_target',
            payload: {
                targetPlayerId: 5
            }
        })).toEqual({
            ok: true,
            targetPlayerId: 5,
            action: {
                type: 'choose_target',
                payload: {
                    targetPlayerId: 5
                }
            }
        });
        expect((0, _pendingactionsrulebookhelper.validatePendingChooseTargetActionForActor)({
            pending,
            actorId: 2,
            actionType: 'choose_target',
            payload: {
                targetPlayerId: 4
            }
        })).toEqual({
            ok: false,
            reason: 'invalid_target',
            targetPlayerId: 4
        });
    });
    it('handles indexed pending choices from data and root', ()=>{
        const fromData = {
            type: 'choose_option',
            playerId: 9,
            data: {
                choices: [
                    'A',
                    'B'
                ]
            }
        };
        expect((0, _pendingactionsrulebookhelper.getPendingIndexedChoiceActionsForPlayer)(fromData, 9)).toEqual([
            {
                type: 'choose_option',
                payload: {
                    choiceIndex: 0
                }
            },
            {
                type: 'choose_option',
                payload: {
                    choiceIndex: 1
                }
            }
        ]);
        expect((0, _pendingactionsrulebookhelper.validatePendingIndexedChoiceActionForActor)({
            pending: fromData,
            actorId: 9,
            actionType: 'choose_option',
            payload: {
                choiceIndex: 1
            }
        })).toEqual({
            ok: true,
            choiceIndex: 1,
            action: {
                type: 'choose_option',
                payload: {
                    choiceIndex: 1
                }
            }
        });
        const fromRoot = {
            type: 'pick',
            playerId: '4',
            choices: [
                'X',
                'Y',
                'Z'
            ]
        };
        expect((0, _pendingactionsrulebookhelper.getPendingIndexedChoiceActionsForPlayer)(fromRoot, 4, {
            pendingType: 'pick',
            actionType: 'pick_choice',
            payloadIndexKey: 'index',
            choicesContainer: 'root',
            samePlayer: (a, b)=>Number(a) === Number(b)
        })).toEqual([
            {
                type: 'pick_choice',
                payload: {
                    index: 0
                }
            },
            {
                type: 'pick_choice',
                payload: {
                    index: 1
                }
            },
            {
                type: 'pick_choice',
                payload: {
                    index: 2
                }
            }
        ]);
        expect((0, _pendingactionsrulebookhelper.validatePendingIndexedChoiceActionForActor)({
            pending: fromRoot,
            actorId: 4,
            actionType: 'pick_choice',
            payload: {
                index: 3
            },
            pendingType: 'pick',
            expectedActionType: 'pick_choice',
            payloadIndexKey: 'index',
            choicesContainer: 'root',
            samePlayer: (a, b)=>Number(a) === Number(b)
        })).toEqual({
            ok: false,
            reason: 'invalid_choice',
            choiceIndex: 3
        });
    });
    it('handles string pending choices from root choices', ()=>{
        const pending = {
            type: 'choose_option',
            playerId: 2,
            choices: [
                'A',
                'B'
            ]
        };
        expect((0, _pendingactionsrulebookhelper.getPendingStringChoiceActionsForPlayer)(pending, 2)).toEqual([
            {
                type: 'choose_option',
                payload: {
                    option: 'A'
                }
            },
            {
                type: 'choose_option',
                payload: {
                    option: 'B'
                }
            }
        ]);
        expect((0, _pendingactionsrulebookhelper.validatePendingStringChoiceActionForActor)({
            pending,
            actorId: 2,
            actionType: 'choose_option',
            payload: {
                option: 'B'
            }
        })).toEqual({
            ok: true,
            option: 'B',
            action: {
                type: 'choose_option',
                payload: {
                    option: 'B'
                }
            }
        });
        expect((0, _pendingactionsrulebookhelper.validatePendingStringChoiceActionForActor)({
            pending,
            actorId: 2,
            actionType: 'choose_option',
            payload: {
                option: 'C'
            }
        })).toEqual({
            ok: false,
            reason: 'invalid_option',
            option: 'C'
        });
    });
    it('handles number pending choices from min/max range', ()=>{
        const pending = {
            type: 'choose_number',
            playerId: 5,
            data: {
                min: 2,
                max: 4
            }
        };
        expect((0, _pendingactionsrulebookhelper.getPendingNumberChoiceActionsForPlayer)(pending, 5)).toEqual([
            {
                type: 'choose_number',
                payload: {
                    value: 2
                }
            },
            {
                type: 'choose_number',
                payload: {
                    value: 3
                }
            },
            {
                type: 'choose_number',
                payload: {
                    value: 4
                }
            }
        ]);
        expect((0, _pendingactionsrulebookhelper.validatePendingNumberChoiceActionForActor)({
            pending,
            actorId: 5,
            actionType: 'choose_number',
            payload: {
                value: 3
            }
        })).toEqual({
            ok: true,
            value: 3,
            action: {
                type: 'choose_number',
                payload: {
                    value: 3
                }
            }
        });
        expect((0, _pendingactionsrulebookhelper.validatePendingNumberChoiceActionForActor)({
            pending,
            actorId: 5,
            actionType: 'choose_number',
            payload: {
                value: 1
            }
        })).toEqual({
            ok: false,
            reason: 'invalid_value',
            value: 1
        });
    });
    it('handles number pending choices from explicit values list', ()=>{
        const pending = {
            type: 'choose_next_player',
            playerId: 1,
            data: {
                playerIds: [
                    3,
                    '5'
                ]
            }
        };
        expect((0, _pendingactionsrulebookhelper.getPendingNumberSetChoiceActionsForPlayer)(pending, 1, {
            pendingType: 'choose_next_player',
            actionType: 'choose_next_player',
            payloadValueKey: 'playerId',
            valuesKey: 'playerIds'
        })).toEqual([
            {
                type: 'choose_next_player',
                payload: {
                    playerId: 3
                }
            },
            {
                type: 'choose_next_player',
                payload: {
                    playerId: 5
                }
            }
        ]);
        expect((0, _pendingactionsrulebookhelper.validatePendingNumberSetChoiceActionForActor)({
            pending,
            actorId: 1,
            actionType: 'choose_next_player',
            payload: {
                playerId: 5
            },
            pendingType: 'choose_next_player',
            expectedActionType: 'choose_next_player',
            payloadValueKey: 'playerId',
            valuesKey: 'playerIds'
        })).toEqual({
            ok: true,
            value: 5,
            action: {
                type: 'choose_next_player',
                payload: {
                    playerId: 5
                }
            }
        });
        expect((0, _pendingactionsrulebookhelper.validatePendingNumberSetChoiceActionForActor)({
            pending,
            actorId: 1,
            actionType: 'choose_next_player',
            payload: {
                playerId: 7
            },
            pendingType: 'choose_next_player',
            expectedActionType: 'choose_next_player',
            payloadValueKey: 'playerId',
            valuesKey: 'playerIds'
        })).toEqual({
            ok: false,
            reason: 'invalid_value',
            value: 7
        });
    });
    it('handles pending choose_card actions and validation', ()=>{
        const pending = {
            type: 'choose_card',
            playerId: 4,
            data: {
                cards: [
                    {
                        cardType: 'bonus',
                        cardId: 10
                    },
                    {
                        cardType: 'malus',
                        cardId: 22
                    }
                ]
            }
        };
        expect((0, _pendingactionsrulebookhelper.getPendingCardChoiceActionsForPlayer)(pending, 4)).toEqual([
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
                    cardType: 'malus',
                    cardId: 22
                }
            }
        ]);
        expect((0, _pendingactionsrulebookhelper.validatePendingCardChoiceActionForActor)({
            pending,
            actorId: 4,
            actionType: 'choose_card',
            payload: {
                cardType: 'malus',
                cardId: 22
            }
        })).toEqual({
            ok: true,
            cardType: 'malus',
            cardId: 22,
            action: {
                type: 'choose_card',
                payload: {
                    cardType: 'malus',
                    cardId: 22
                }
            }
        });
        expect((0, _pendingactionsrulebookhelper.validatePendingCardChoiceActionForActor)({
            pending,
            actorId: 4,
            actionType: 'choose_card',
            payload: {
                cardType: 'bonus',
                cardId: 99
            }
        })).toEqual({
            ok: false,
            reason: 'invalid_card'
        });
    });
});
