"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _lesabsurdissimesservice = require("../les-absurdissimes.service");
describe('LesAbsurdissimesService', ()=>{
    it('should be defined', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _lesabsurdissimesservice.LesAbsurdissimesService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
