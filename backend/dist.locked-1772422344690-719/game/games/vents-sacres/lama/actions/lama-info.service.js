"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaInfoService", {
    enumerable: true,
    get: function() {
        return LamaInfoService;
    }
});
const _common = require("@nestjs/common");
const _lamamodel = require("../model/lama.model");
const _lamasharedservice = require("../shared/lama-shared.service");
const _lamalogservice = require("../logging/lama-log.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LamaInfoService = class LamaInfoService {
    applyInfoAction(state, meta, actionType, actorId) {
        if (actionType === 'lama_preview') return state;
        const discard = Array.isArray(meta.discard) ? meta.discard : [];
        const top = discard.length ? discard[discard.length - 1] : null;
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.shared.playerLabel(players, actorId);
        const log = this.logger.append(state.log, `${name} regarde la défausse : ${top ? (0, _lamamodel.lamaCardLabel)(top) : '(vide)'}.`);
        return {
            ...state,
            log
        };
    }
    constructor(shared, logger){
        this.shared = shared;
        this.logger = logger;
    }
};
LamaInfoService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService,
        typeof _lamalogservice.LamaLogService === "undefined" ? Object : _lamalogservice.LamaLogService
    ])
], LamaInfoService);
