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
exports.LamaInfoService = void 0;
const common_1 = require("@nestjs/common");
const lama_model_1 = require("../model/lama.model");
const lama_shared_service_1 = require("../shared/lama-shared.service");
const lama_log_service_1 = require("../logging/lama-log.service");
let LamaInfoService = class LamaInfoService {
    shared;
    logger;
    constructor(shared, logger) {
        this.shared = shared;
        this.logger = logger;
    }
    applyInfoAction(state, meta, actionType, actorId) {
        if (actionType === 'lama_preview')
            return state;
        const discard = Array.isArray(meta.discard) ? meta.discard : [];
        const top = discard.length ? discard[discard.length - 1] : null;
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.shared.playerLabel(players, actorId);
        const log = this.logger.append(state.log, `${name} regarde la défausse : ${top ? (0, lama_model_1.lamaCardLabel)(top) : '(vide)'}.`);
        return { ...state, log };
    }
};
exports.LamaInfoService = LamaInfoService;
exports.LamaInfoService = LamaInfoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [lama_shared_service_1.LamaSharedService,
        lama_log_service_1.LamaLogService])
], LamaInfoService);
//# sourceMappingURL=lama-info.service.js.map