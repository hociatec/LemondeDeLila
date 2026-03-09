"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _nawakservice = require("../nawak.service");
describe('NawakService', ()=>{
    it('should be defined', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _nawakservice.NawakService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
