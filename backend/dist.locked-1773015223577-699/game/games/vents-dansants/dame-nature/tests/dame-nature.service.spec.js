"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _damenatureservice = require("../dame-nature.service");
describe('DameNatureService', ()=>{
    it('devrait être défini', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _damenatureservice.DameNatureService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
