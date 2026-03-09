"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _zigetzagservice = require("../zig-et-zag.service");
describe('ZigEtZagService', ()=>{
    it('should be defined', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _zigetzagservice.ZigEtZagService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
