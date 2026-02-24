"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorridorService = void 0;
const common_1 = require("@nestjs/common");
const game_registry_service_1 = require("../../../engine/services/game-registry.service");
const abstract_game_service_1 = require("../../../engine/abstract/abstract-game.service");
const corridor_setup_service_1 = require("./setup/corridor-setup.service");
const corridor_action_service_1 = require("./actions/corridor-action.service");
const corridor_presenter_service_1 = require("./presenter/corridor-presenter.service");
const game_definition_1 = require("./definitions/game.definition");
const corridor_bot_service_1 = require("./bots/corridor-bot.service");
let CorridorService = class CorridorService extends abstract_game_service_1.AbstractGameService {
    setup;
    actions;
    presenter;
    bots;
    gameType = 'corridor';
    category = 'JeuxDePlateaux';
    subcategory = 'Les Vents Sacrés';
    displayName = game_definition_1.CORRIDOR_GAME.displayName;
    description = 'Déplacez votre pion sur une grille (9×9) et atteignez le bord opposé.';
    minPlayers = game_definition_1.CORRIDOR_GAME.minPlayers;
    maxPlayers = game_definition_1.CORRIDOR_GAME.maxPlayers;
    constructor(registry, setup, actions, presenter, bots) {
        super(registry);
        this.setup = setup;
        this.actions = actions;
        this.presenter = presenter;
        this.bots = bots;
        this.registry = registry;
    }
    registry;
    hydrateInitialState(baseState) {
        return this.setup.hydrateInitialState(baseState);
    }
    applyActions(state, actions) {
        return this.actions.applyActions(state, actions);
    }
    getBotActions(state, botPlayerId) {
        return this.bots.getBotActions(state, botPlayerId);
    }
    exposeStateForUser(state, userId) {
        return this.presenter.exposeStateForUser(state, userId);
    }
};
exports.CorridorService = CorridorService;
exports.CorridorService = CorridorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_registry_service_1.GameRegistryService,
        corridor_setup_service_1.CorridorSetupService,
        corridor_action_service_1.CorridorActionService,
        corridor_presenter_service_1.CorridorPresenterService,
        corridor_bot_service_1.CorridorBotService])
], CorridorService);
//# sourceMappingURL=corridor.service.js.map