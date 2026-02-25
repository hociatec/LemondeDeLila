"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _gerardpresidentservice = require("../gerard-president.service");
describe('GerardPresidentService', ()=>{
    it('should be defined', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _gerardpresidentservice.GerardPresidentService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
