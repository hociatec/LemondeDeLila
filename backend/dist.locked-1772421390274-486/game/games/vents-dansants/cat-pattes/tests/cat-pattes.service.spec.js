"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _testing = require("@nestjs/testing");
const _catpattesservice = require("../cat-pattes.service");
const _gameregistryservice = require("../../../../engine/services/game-registry.service");
const _catpattessetupservice = require("../setup/cat-pattes-setup.service");
const _catpattesactionservice = require("../actions/cat-pattes-action.service");
const _catpattespresenterservice = require("../presenter/cat-pattes-presenter.service");
const _catpattesbotservice = require("../bots/cat-pattes-bot.service");
describe('CatPattesService', ()=>{
    it('should be defined', async ()=>{
        const module = await _testing.Test.createTestingModule({
            providers: [
                _catpattesservice.CatPattesService,
                {
                    provide: _gameregistryservice.GameRegistryService,
                    useValue: {
                        register: jest.fn()
                    }
                },
                {
                    provide: _catpattessetupservice.CatPattesSetupService,
                    useValue: {}
                },
                {
                    provide: _catpattesactionservice.CatPattesActionService,
                    useValue: {}
                },
                {
                    provide: _catpattespresenterservice.CatPattesPresenterService,
                    useValue: {}
                },
                {
                    provide: _catpattesbotservice.CatPattesBotService,
                    useValue: {}
                }
            ]
        }).compile();
        const service = module.get(_catpattesservice.CatPattesService);
        expect(service).toBeDefined();
    });
});
