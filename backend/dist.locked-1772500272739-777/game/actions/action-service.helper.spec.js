"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _actionservicehelper = require("./action-service.helper");
describe('action-service.helper non-regression', ()=>{
    it('normalizes legacy roll aliases', ()=>{
        expect((0, _actionservicehelper.isRollAlias)('ROLL_DICE')).toBe(true);
        expect((0, _actionservicehelper.isRollAlias)('roll_dice')).toBe(true);
        expect((0, _actionservicehelper.normalizeRollActionType)('ROLL_DICE')).toBe('roll');
        expect((0, _actionservicehelper.normalizeRollActionType)('roll_dice')).toBe('roll');
        expect((0, _actionservicehelper.normalizeLegacyRollAliasToUpper)('roll_dice')).toBe('ROLL_DICE');
        expect((0, _actionservicehelper.isRollActionType)('ROLL_DICE')).toBe(true);
    });
    it('dispatches legacy roll alias to canonical roll handler', ()=>{
        const out = (0, _actionservicehelper.dispatchByActionType)('ROLL_DICE', {
            roll: ()=>'roll-ok'
        }, ()=>'fallback');
        expect(out).toBe('roll-ok');
    });
    it('runs action pipeline in guard -> validation -> transition -> effects -> logs order', ()=>{
        const calls = [];
        const out = (0, _actionservicehelper.applyActionPipeline)({
            value: 1
        }, {
            type: 'x'
        }, {
            guard: ()=>{
                calls.push('guard');
                return true;
            },
            validate: ()=>{
                calls.push('validate');
                return 2;
            },
            transition: (_state, _action, payload)=>{
                calls.push('transition');
                return {
                    value: payload + 1
                };
            },
            effects: (_state, _action, _payload, transitioned)=>{
                calls.push('effects');
                return {
                    value: transitioned.value * 3
                };
            },
            logs: (_state, _action, _payload, _transitioned, effected)=>{
                calls.push('logs');
                return {
                    value: effected.value + 1
                };
            }
        });
        expect(calls).toEqual([
            'guard',
            'validate',
            'transition',
            'effects',
            'logs'
        ]);
        expect(out).toEqual({
            value: 10
        });
    });
    it('returns original state when pipeline guard rejects action', ()=>{
        const state = {
            value: 42
        };
        const out = (0, _actionservicehelper.applyActionPipeline)(state, {
            type: 'x'
        }, {
            guard: ()=>false,
            transition: ()=>({
                    value: 0
                })
        });
        expect(out).toBe(state);
    });
    it('harmonizes action return shape with pending and metadata defaults', ()=>{
        const out = (0, _actionservicehelper.harmonizeActionStateReturn)({
            status: 'started',
            pending: undefined,
            metadata: undefined,
            turnIndex: 2
        });
        expect(out.pending).toBeNull();
        expect(out.metadata).toEqual({});
        expect(out.status).toBe('started');
        expect(out.turnIndex).toBe(2);
    });
});
