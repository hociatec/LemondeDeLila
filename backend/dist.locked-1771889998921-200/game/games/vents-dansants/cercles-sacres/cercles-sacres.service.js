"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CerclesSacresService = void 0;
const common_1 = require("@nestjs/common");
const game_registry_service_1 = require("../../../engine/services/game-registry.service");
const abstract_game_service_1 = require("../../../engine/abstract/abstract-game.service");
const Rulebook = __importStar(require("./rulebook/rulebook"));
const cercles_sacres_action_service_1 = require("./actions/cercles-sacres-action.service");
const cercles_sacres_presenter_service_1 = require("./presenter/cercles-sacres-presenter.service");
const cercles_sacres_setup_service_1 = require("./setup/cercles-sacres-setup.service");
const cercles_sacres_bot_service_1 = require("./bots/cercles-sacres-bot.service");
const game_definition_1 = require("./definitions/game.definition");
const cercles_sacres_shortcuts_1 = require("./cercles-sacres.shortcuts");
let CerclesSacresService = class CerclesSacresService extends abstract_game_service_1.AbstractGameService {
    setup;
    actions;
    presenter;
    bots;
    gameType = 'cercles-sacres';
    category = 'JeuxDePlateaux';
    subcategory = 'VentsDansants';
    displayName = game_definition_1.CERCLES_SACRES_GAME.displayName;
    description = 'Formez trois Cercles Sacrés en alignant six cartes thématiques.';
    minPlayers = game_definition_1.CERCLES_SACRES_GAME.minPlayers;
    maxPlayers = game_definition_1.CERCLES_SACRES_GAME.maxPlayers;
    constructor(registry, setup, actions, presenter, bots) {
        super(registry);
        this.setup = setup;
        this.actions = actions;
        this.presenter = presenter;
        this.bots = bots;
    }
    hydrateInitialState(baseState) {
        return this.setup.hydrateInitialState(baseState);
    }
    applyActions(state, actions) {
        return this.actions.applyActions(state, actions);
    }
    getAvailableActions(state, playerId) {
        return Rulebook.getAvailableActions(state, playerId);
    }
    validateAction(state, action, actorId) {
        return Rulebook.validateAction(state, action, actorId);
    }
    exposeStateForUser(state, userId) {
        return this.presenter.exposeStateForUser(state, userId);
    }
    getBotActions(state, botPlayerId) {
        return this.bots.getBotActions(state, botPlayerId);
    }
    getShortcuts(ctx) {
        return (0, cercles_sacres_shortcuts_1.buildCerclesSacresShortcuts)(ctx);
    }
};
exports.CerclesSacresService = CerclesSacresService;
exports.CerclesSacresService = CerclesSacresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_registry_service_1.GameRegistryService,
        cercles_sacres_setup_service_1.CerclesSacresSetupService,
        cercles_sacres_action_service_1.CerclesSacresActionService,
        cercles_sacres_presenter_service_1.CerclesSacresPresenterService,
        cercles_sacres_bot_service_1.CerclesSacresBotService])
], CerclesSacresService);
//# sourceMappingURL=cercles-sacres.service.js.map