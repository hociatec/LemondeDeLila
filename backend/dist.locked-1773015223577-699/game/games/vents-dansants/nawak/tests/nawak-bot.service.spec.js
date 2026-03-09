"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _nawakbotservice = require("../bots/nawak-bot.service");
describe('NawakBotService', ()=>{
    it('should be defined', ()=>{
        const runner = {
            choose: ()=>[]
        };
        const service = new _nawakbotservice.NawakBotService(runner);
        expect(service).toBeDefined();
    });
});
