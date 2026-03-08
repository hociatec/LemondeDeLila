"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _payloadvalidatorshelper = require("./payload-validators.helper");
describe('payload-validators.helper', ()=>{
    it('reads required and optional integers', ()=>{
        expect((0, _payloadvalidatorshelper.requiredInt)({
            value: '12'
        }, 'value')).toBe(12);
        expect((0, _payloadvalidatorshelper.optionalInt)({
            value: '3'
        }, 'value')).toBe(3);
        expect((0, _payloadvalidatorshelper.optionalInt)({
            value: ''
        }, 'value')).toBeUndefined();
        expect(()=>(0, _payloadvalidatorshelper.requiredInt)({
                value: '12.9'
            }, 'value')).toThrow('value est requis.');
    });
    it('reads required and optional strings', ()=>{
        expect((0, _payloadvalidatorshelper.requiredString)({
            value: '  abc '
        }, 'value')).toBe('abc');
        expect((0, _payloadvalidatorshelper.optionalString)({
            value: '  abc '
        }, 'value')).toBe('abc');
        expect((0, _payloadvalidatorshelper.optionalString)({
            value: '  '
        }, 'value')).toBeUndefined();
    });
    it('validates enum values', ()=>{
        expect((0, _payloadvalidatorshelper.requiredEnumValue)({
            move: 'left'
        }, 'move', [
            'left',
            'right'
        ])).toBe('left');
        expect(()=>(0, _payloadvalidatorshelper.requiredEnumValue)({
                move: 'up'
            }, 'move', [
                'left',
                'right'
            ])).toThrow('move est invalide.');
    });
    it('validates array index bounds', ()=>{
        expect((0, _payloadvalidatorshelper.requiredArrayIndex)({
            idx: 1
        }, 'idx', 3)).toBe(1);
        expect(()=>(0, _payloadvalidatorshelper.requiredArrayIndex)({
                idx: 4
            }, 'idx', 3)).toThrow('idx est hors limites.');
    });
    it('throws clear errors for missing required fields', ()=>{
        expect(()=>(0, _payloadvalidatorshelper.requiredInt)({}, 'value')).toThrow('value est requis.');
        expect(()=>(0, _payloadvalidatorshelper.requiredString)({}, 'value')).toThrow('value est requis.');
    });
});
