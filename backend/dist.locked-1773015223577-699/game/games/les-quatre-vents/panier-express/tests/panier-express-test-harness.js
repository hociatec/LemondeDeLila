"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createPanierExpressTestingModule", {
    enumerable: true,
    get: function() {
        return createPanierExpressTestingModule;
    }
});
const _testing = require("@nestjs/testing");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _deckpoolservice = require("../../../../modules/cards/services/deck-pool.service");
const _deckmanagerservice = require("../../../../modules/cards/services/deck-manager.service");
const _boardmovementservice = require("../../../../modules/board/services/board-movement.service");
const _boardpayloadservice = require("../../../../modules/board/services/board-payload.service");
const _tileeffectregistryservice = require("../../../../modules/effects/services/tile-effect-registry.service");
const _standeffectregistryservice = require("../../../../modules/effects/services/stand-effect-registry.service");
const _turnactionsservice = require("../../../../modules/turn/services/turn-actions.service");
const _turnservice = require("../../../../modules/turn/services/turn.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _turnstatusservice = require("../../../../modules/turn/services/turn-status.service");
const _turnpoliciesservice = require("../../../../modules/turn-policies/services/turn-policies.service");
const _actionresolverservice = require("../../../../modules/action-resolver/services/action-resolver.service");
const _quizrunnerservice = require("../../../../modules/quiz/services/quiz-runner.service");
const _victoryservice = require("../../../../modules/victory/services/victory.service");
const _actionlogservice = require("../../../../modules/actionlog/services/action-log.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _botrunnerservice = require("../../../../modules/bot/services/bot-runner.service");
const _interactiveexchangeservice = require("../../../../modules/exchange/services/interactive-exchange.service");
const _gameregistryservice = require("../../../../engine/services/game-registry.service");
const _gamecontentloaderservice = require("../../../../engine/services/game-content-loader.service");
const _panierexpressservice = require("../panier-express.service");
const _panierexpresssetupservice = require("../setup/panier-express-setup.service");
const _panierexpressdrawservice = require("../actions/panier-express-draw.service");
const _panierexpressquizservice = require("../actions/panier-express-quiz.service");
const _panierexpressexchangeservice = require("../actions/panier-express-exchange.service");
const _panierexpressutilsservice = require("../model/panier-express-utils.service");
const _panierexpressdeckservice = require("../actions/panier-express-deck.service");
const _panierexpressbotservice = require("../bots/panier-express-bot.service");
const _panierexpressphaseservice = require("../phases/panier-express-phase.service");
const _panierexpresspresenterservice = require("../presenter/panier-express-presenter.service");
async function createPanierExpressTestingModule() {
    const moduleRef = await _testing.Test.createTestingModule({
        providers: [
            _gamecoreservice.GameCoreService,
            _deckpoolservice.DeckPoolService,
            _deckmanagerservice.DeckManagerService,
            _boardmovementservice.BoardMovementService,
            _boardpayloadservice.BoardPayloadService,
            _tileeffectregistryservice.TileEffectRegistryService,
            _standeffectregistryservice.StandEffectRegistryService,
            _turnactionsservice.TurnActionsService,
            _turnservice.TurnService,
            _turnpoliciesservice.TurnPoliciesService,
            _turnflowservice.TurnFlowService,
            _turnstatusservice.TurnStatusService,
            _actionresolverservice.ActionResolverService,
            _quizrunnerservice.QuizRunnerService,
            _victoryservice.VictoryService,
            _actionlogservice.ActionLogService,
            _randomservice.RandomService,
            _interactiveexchangeservice.InteractiveExchangeService,
            _gamecontentloaderservice.GameContentLoaderService,
            _panierexpresssetupservice.PanierExpressSetupService,
            _panierexpressdrawservice.PanierExpressDrawService,
            _panierexpressquizservice.PanierExpressQuizService,
            _panierexpressexchangeservice.PanierExpressExchangeService,
            _panierexpressutilsservice.PanierExpressUtils,
            _panierexpressdeckservice.PanierExpressDeckService,
            _panierexpressbotservice.PanierExpressBotService,
            _panierexpressphaseservice.PanierExpressPhaseService,
            _panierexpresspresenterservice.PanierExpressPresenterService,
            {
                provide: _gameregistryservice.GameRegistryService,
                useValue: {
                    register: ()=>{}
                }
            },
            {
                provide: _botrunnerservice.BotRunnerService,
                useValue: {
                    choose: (actions, _ctx, _profile, opts)=>{
                        const safe = Array.isArray(actions) ? actions : [];
                        const prefer = Array.isArray(opts?.preferTypes) ? opts.preferTypes : [];
                        for (const type of prefer){
                            const match = safe.find((a)=>(a?.type || '').toLowerCase() === String(type).toLowerCase());
                            if (match) return [
                                match
                            ];
                        }
                        const fallback = Array.isArray(opts?.fallbackTypes) ? opts.fallbackTypes : [];
                        for (const type of fallback){
                            const match = safe.find((a)=>(a?.type || '').toLowerCase() === String(type).toLowerCase());
                            if (match) return [
                                match
                            ];
                        }
                        return safe.length ? [
                            safe[0]
                        ] : [];
                    },
                    suggestForHandler: ()=>null
                }
            },
            _panierexpressservice.PanierExpressService
        ]
    }).compile();
    await moduleRef.init();
    return moduleRef;
}
