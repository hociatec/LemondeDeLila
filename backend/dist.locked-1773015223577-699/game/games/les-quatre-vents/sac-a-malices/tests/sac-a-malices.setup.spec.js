"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _testing = require("@nestjs/testing");
const _gamecontentloaderservice = require("../../../../engine/services/game-content-loader.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _setupflowmodule = require("../../../../modules/setup-flow/setup-flow.module");
const _sacamalicessetupservice = require("../setup/sac-a-malices-setup.service");
const _sacamalicesvariants = require("../sac-a-malices-variants");
describe('Sac À Malices setup', ()=>{
    it("publie une demande de variante quand aucun choix n'est encore fait", async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            imports: [
                _setupflowmodule.SetupFlowModule
            ],
            providers: [
                _gamecontentloaderservice.GameContentLoaderService,
                _randomservice.RandomService,
                _sacamalicessetupservice.SacAMalicesSetupService
            ]
        }).compile();
        const setup = moduleRef.get(_sacamalicessetupservice.SacAMalicesSetupService);
        const base = {
            status: 'open',
            phase: 'setup',
            players: [
                {
                    id: 1,
                    username: 'Annie'
                },
                {
                    id: 2,
                    username: 'Benoît'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            metadata: {
                gameType: 'sac-a-malices'
            }
        };
        const next = setup.hydrateInitialState(base);
        expect(next.pending).not.toBeNull();
        expect(next.pending?.type).toBe('sac_variant_choice');
        expect(next.pending?.choices).toContain(_sacamalicesvariants.SAC_VARIANTS[0].label);
        const variants = next.pending?.data?.variants ?? [];
        expect(Array.isArray(variants)).toBe(true);
        expect(variants.length).toBe(_sacamalicesvariants.SAC_VARIANTS.length);
        expect(next.turn?.currentPlayerId).toBe(next.pending?.playerId);
    });
});
