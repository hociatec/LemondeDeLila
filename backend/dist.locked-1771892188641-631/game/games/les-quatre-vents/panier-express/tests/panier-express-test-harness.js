"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPanierExpressTestingModule = createPanierExpressTestingModule;
const testing_1 = require("@nestjs/testing");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const deck_pool_service_1 = require("../../../../modules/cards/services/deck-pool.service");
const deck_manager_service_1 = require("../../../../modules/cards/services/deck-manager.service");
const board_movement_service_1 = require("../../../../modules/board/services/board-movement.service");
const board_payload_service_1 = require("../../../../modules/board/services/board-payload.service");
const tile_effect_registry_service_1 = require("../../../../modules/effects/services/tile-effect-registry.service");
const stand_effect_registry_service_1 = require("../../../../modules/effects/services/stand-effect-registry.service");
const turn_actions_service_1 = require("../../../../modules/turn/services/turn-actions.service");
const turn_service_1 = require("../../../../modules/turn/services/turn.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const turn_status_service_1 = require("../../../../modules/turn/services/turn-status.service");
const turn_policies_service_1 = require("../../../../modules/turn-policies/services/turn-policies.service");
const action_resolver_service_1 = require("../../../../modules/action-resolver/services/action-resolver.service");
const quiz_runner_service_1 = require("../../../../modules/quiz/services/quiz-runner.service");
const victory_service_1 = require("../../../../modules/victory/services/victory.service");
const action_log_service_1 = require("../../../../modules/actionlog/services/action-log.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const bot_runner_service_1 = require("../../../../modules/bot/services/bot-runner.service");
const interactive_exchange_service_1 = require("../../../../modules/exchange/services/interactive-exchange.service");
const game_registry_service_1 = require("../../../../engine/services/game-registry.service");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const panier_express_service_1 = require("../panier-express.service");
const panier_express_setup_service_1 = require("../setup/panier-express-setup.service");
const panier_express_draw_service_1 = require("../actions/panier-express-draw.service");
const panier_express_quiz_service_1 = require("../actions/panier-express-quiz.service");
const panier_express_exchange_service_1 = require("../actions/panier-express-exchange.service");
const panier_express_utils_service_1 = require("../model/panier-express-utils.service");
const panier_express_deck_service_1 = require("../actions/panier-express-deck.service");
const panier_express_bot_service_1 = require("../bots/panier-express-bot.service");
const panier_express_phase_service_1 = require("../phases/panier-express-phase.service");
const panier_express_presenter_service_1 = require("../presenter/panier-express-presenter.service");
async function createPanierExpressTestingModule() {
    const moduleRef = await testing_1.Test.createTestingModule({
        providers: [
            game_core_service_1.GameCoreService,
            deck_pool_service_1.DeckPoolService,
            deck_manager_service_1.DeckManagerService,
            board_movement_service_1.BoardMovementService,
            board_payload_service_1.BoardPayloadService,
            tile_effect_registry_service_1.TileEffectRegistryService,
            stand_effect_registry_service_1.StandEffectRegistryService,
            turn_actions_service_1.TurnActionsService,
            turn_service_1.TurnService,
            turn_policies_service_1.TurnPoliciesService,
            turn_flow_service_1.TurnFlowService,
            turn_status_service_1.TurnStatusService,
            action_resolver_service_1.ActionResolverService,
            quiz_runner_service_1.QuizRunnerService,
            victory_service_1.VictoryService,
            action_log_service_1.ActionLogService,
            random_service_1.RandomService,
            interactive_exchange_service_1.InteractiveExchangeService,
            game_content_loader_service_1.GameContentLoaderService,
            panier_express_setup_service_1.PanierExpressSetupService,
            panier_express_draw_service_1.PanierExpressDrawService,
            panier_express_quiz_service_1.PanierExpressQuizService,
            panier_express_exchange_service_1.PanierExpressExchangeService,
            panier_express_utils_service_1.PanierExpressUtils,
            panier_express_deck_service_1.PanierExpressDeckService,
            panier_express_bot_service_1.PanierExpressBotService,
            panier_express_phase_service_1.PanierExpressPhaseService,
            panier_express_presenter_service_1.PanierExpressPresenterService,
            {
                provide: game_registry_service_1.GameRegistryService,
                useValue: {
                    register: () => { },
                },
            },
            {
                provide: bot_runner_service_1.BotRunnerService,
                useValue: {
                    choose: (actions, _ctx, _profile, opts) => {
                        const safe = Array.isArray(actions) ? actions : [];
                        const prefer = Array.isArray(opts?.preferTypes)
                            ? opts.preferTypes
                            : [];
                        for (const type of prefer) {
                            const match = safe.find((a) => (a?.type || '').toLowerCase() === String(type).toLowerCase());
                            if (match)
                                return [match];
                        }
                        const fallback = Array.isArray(opts?.fallbackTypes)
                            ? opts.fallbackTypes
                            : [];
                        for (const type of fallback) {
                            const match = safe.find((a) => (a?.type || '').toLowerCase() === String(type).toLowerCase());
                            if (match)
                                return [match];
                        }
                        return safe.length ? [safe[0]] : [];
                    },
                    suggestForHandler: () => null,
                },
            },
            panier_express_service_1.PanierExpressService,
        ],
    }).compile();
    await moduleRef.init();
    return moduleRef;
}
//# sourceMappingURL=panier-express-test-harness.js.map