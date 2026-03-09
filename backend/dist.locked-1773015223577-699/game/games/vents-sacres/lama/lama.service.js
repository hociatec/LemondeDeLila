"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaService", {
    enumerable: true,
    get: function() {
        return LamaService;
    }
});
const _common = require("@nestjs/common");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _lamapresenter = require("./lama.presenter");
const _lamaactionservice = require("./actions/lama-action.service");
const _lamasetupservice = require("./setup/lama-setup.service");
const _lamabotservice = require("./bots/lama-bot.service");
const _lamashortcutsservice = require("./shortcuts/lama-shortcuts.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LamaService = class LamaService extends _abstractgameservice.AbstractGameService {
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
    constructor(registry, presenter, actions, setup, bots, shortcuts){
        super(registry), this.presenter = presenter, this.actions = actions, this.setup = setup, this.bots = bots, this.shortcuts = shortcuts, this.gameType = 'lama', this.category = 'JeuxDePlateaux', this.subcategory = 'Les Vents Sacrés', this.displayName = 'LAMA', this.description = 'Défaussez vos cartes ou sortez de la manche pour minimiser vos jetons.', this.minPlayers = 2, this.maxPlayers = 6;
    }
};
LamaService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _lamapresenter.LamaPresenter === "undefined" ? Object : _lamapresenter.LamaPresenter,
        typeof _lamaactionservice.LamaActionService === "undefined" ? Object : _lamaactionservice.LamaActionService,
        typeof _lamasetupservice.LamaSetupService === "undefined" ? Object : _lamasetupservice.LamaSetupService,
        typeof _lamabotservice.LamaBotService === "undefined" ? Object : _lamabotservice.LamaBotService,
        typeof _lamashortcutsservice.LamaShortcutsService === "undefined" ? Object : _lamashortcutsservice.LamaShortcutsService
    ])
], LamaService);
