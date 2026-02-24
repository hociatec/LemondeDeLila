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
exports.LamaService = void 0;
const common_1 = require("@nestjs/common");
const abstract_game_service_1 = require("../../../engine/abstract/abstract-game.service");
const game_registry_service_1 = require("../../../engine/services/game-registry.service");
const lama_presenter_1 = require("./lama.presenter");
const lama_action_service_1 = require("./actions/lama-action.service");
const lama_setup_service_1 = require("./setup/lama-setup.service");
const lama_bot_service_1 = require("./bots/lama-bot.service");
const lama_shortcuts_service_1 = require("./shortcuts/lama-shortcuts.service");
let LamaService = class LamaService extends abstract_game_service_1.AbstractGameService {
    presenter;
    actions;
    setup;
    bots;
    shortcuts;
    gameType = 'lama';
    category = 'JeuxDePlateaux';
    subcategory = 'Les Vents Sacrés';
    displayName = 'LAMA';
    description = 'Défaussez vos cartes ou sortez de la manche pour minimiser vos jetons.';
    minPlayers = 2;
    maxPlayers = 6;
    constructor(registry, presenter, actions, setup, bots, shortcuts) {
        super(registry);
        this.presenter = presenter;
        this.actions = actions;
        this.setup = setup;
        this.bots = bots;
        this.shortcuts = shortcuts;
    }
    hydrateInitialState(baseState) {
        return this.setup.hydrateInitialState(baseState);
    }
    applyActions(state, actions) {
        return this.actions.applyActions(state, actions);
    }
    exposeStateForUser(state, userId) {
        return this.presenter.exposeStateForUser(state, userId);
    }
    getBotActions(state, botPlayerId) {
        return this.bots.getBotActions(state, botPlayerId);
    }
    getShortcuts(ctx) {
        return this.shortcuts.getShortcuts(ctx);
    }
};
exports.LamaService = LamaService;
exports.LamaService = LamaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_registry_service_1.GameRegistryService,
        lama_presenter_1.LamaPresenter,
        lama_action_service_1.LamaActionService,
        lama_setup_service_1.LamaSetupService,
        lama_bot_service_1.LamaBotService,
        lama_shortcuts_service_1.LamaShortcutsService])
], LamaService);
//# sourceMappingURL=lama.service.js.map