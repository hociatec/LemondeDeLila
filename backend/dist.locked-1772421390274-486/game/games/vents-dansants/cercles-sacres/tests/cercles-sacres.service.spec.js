"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _cerclessacresservice = require("../cercles-sacres.service");
describe('CerclesSacresService', ()=>{
    it('should be defined', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _cerclessacresservice.CerclesSacresService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
