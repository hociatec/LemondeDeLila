"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _lesmainsdelaterrebotservice = require("../bots/les-mains-de-la-terre-bot.service");
describe('LesMainsDeLaTerreBotService', ()=>{
    it('doit être défini', ()=>{
        const runner = {
            choose: ()=>[]
        };
        const service = new _lesmainsdelaterrebotservice.LesMainsDeLaTerreBotService(runner);
        expect(service).toBeDefined();
    });
});
