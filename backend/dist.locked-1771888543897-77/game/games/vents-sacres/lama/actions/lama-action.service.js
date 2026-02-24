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
exports.LamaActionService = void 0;
const common_1 = require("@nestjs/common");
const lama_shared_service_1 = require("../shared/lama-shared.service");
const lama_draw_service_1 = require("./lama-draw.service");
const lama_pass_service_1 = require("./lama-pass.service");
const lama_play_service_1 = require("./lama-play.service");
const lama_quit_service_1 = require("./lama-quit.service");
const lama_return_service_1 = require("./lama-return.service");
const lama_info_service_1 = require("./lama-info.service");
const lama_setup_service_1 = require("../setup/lama-setup.service");
const lama_log_service_1 = require("../logging/lama-log.service");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
let LamaActionService = class LamaActionService {
    shared;
    drawService;
    playService;
    quitService;
    returnService;
    infoService;
    setupService;
    logger;
    constructor(shared, drawService, _passService, playService, quitService, returnService, infoService, setupService, logger) {
        this.shared = shared;
        this.drawService = drawService;
        this.playService = playService;
        this.quitService = quitService;
        this.returnService = returnService;
        this.infoService = infoService;
        this.setupService = setupService;
        this.logger = logger;
    }
    applyActions(state, actions) {
        return (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => {
            const applied = this.applyOne(next, action);
            return this.appendTurnAnnouncementIfNeeded(next, applied);
        });
    }
    appendTurnAnnouncementIfNeeded(previous, next) {
        const previousStatus = String(previous.status ?? '').toLowerCase();
        const nextStatus = String(next.status ?? '').toLowerCase();
        if (previousStatus !== 'started' || nextStatus !== 'started') {
            return next;
        }
        const prevPlayerId = previous.turn?.currentPlayerId ?? null;
        const nextPlayerId = next.turn?.currentPlayerId ?? null;
        if (prevPlayerId == null ||
            nextPlayerId == null ||
            prevPlayerId === nextPlayerId) {
            return next;
        }
        const players = Array.isArray(next.players) ? next.players : [];
        const name = this.shared.playerLabel(players, nextPlayerId);
        const message = `C'est au tour de ${name}.`;
        const log = this.logger.append(next.log, message);
        const meta = { ...(next.metadata ?? {}) };
        return {
            ...next,
            log,
            metadata: {
                ...meta,
                suppressTurnAnnouncement: true,
            },
        };
    }
    applyOne(state, action) {
        const type = (0, action_service_helper_1.normalizeActionType)(action);
        if (!type)
            return state;
        const actorId = typeof action?.meta?.actorId === 'number'
            ? action.meta.actorId
            : (state.turn?.currentPlayerId ?? null);
        if (!actorId)
            return state;
        const meta = { ...(state.metadata ?? {}) };
        if (meta.winnerId)
            return state;
        const players = Array.isArray(state.players) ? state.players : [];
        const status = String(state.status ?? '').toLowerCase();
        if (type === 'lama_peek_discard' || type === 'lama_preview') {
            return this.infoService.applyInfoAction(state, meta, type, actorId);
        }
        if ((meta.step ?? '') === 'setup_config') {
            if (type !== 'lama_set_config')
                return state;
            return this.setupService.applySetupConfig(state, meta, action, actorId);
        }
        if ((meta.step ?? '') === 'round_pause') {
            if (type !== 'lama_resume_round')
                return state;
            return this.setupService.resumeRoundPause(state, meta);
        }
        if (status !== 'started') {
            return state;
        }
        const currentPlayerId = state.turn?.currentPlayerId ?? null;
        if (currentPlayerId == null || actorId !== currentPlayerId) {
            return state;
        }
        const metaForTurn = this.shared.ensureTurnTracker(meta, actorId);
        if ((meta.step ?? 'turn_choice') === 'return_token') {
            return this.returnService.applyReturnToken(state, metaForTurn, actorId, action);
        }
        if (type === 'draw') {
            if (meta.droppedOutByPlayerId?.[String(actorId)])
                return state;
            try {
                const current = players.find((p) => p?.id === actorId);
                const isBot = Boolean(current?.isBot);
                const turnIndex = Number(state.turnIndex ?? 0);
                const drawCount = this.shared.getCurrentTurnDrawCount(metaForTurn, actorId, turnIndex);
                const maxDraws = this.shared.getMaxDrawsPerTurn(metaForTurn);
                const canDraw = drawCount < maxDraws;
                if (isBot && canDraw) {
                    const name = this.shared.playerLabel(players, actorId);
                    if (drawCount === 0) {
                        const logWithWarning = this.logger.append(state.log, `${name} doit piocher.`);
                        return this.drawService.applyDraw({ ...state, log: logWithWarning }, metaForTurn, actorId);
                    }
                    return this.drawService.applyDraw(state, metaForTurn, actorId);
                }
            }
            catch {
            }
            return this.drawService.applyDraw(state, metaForTurn, actorId);
        }
        if (type === 'lama_quit') {
            return this.quitService.applyQuit(state, metaForTurn, actorId);
        }
        if (type === 'lama_pass') {
            return this.quitService.applyQuit(state, metaForTurn, actorId);
        }
        if (type === 'lama_play') {
            if (meta.droppedOutByPlayerId[String(actorId)])
                return state;
            return this.playService.applyPlay(state, metaForTurn, actorId, action);
        }
        return state;
    }
};
exports.LamaActionService = LamaActionService;
exports.LamaActionService = LamaActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [lama_shared_service_1.LamaSharedService,
        lama_draw_service_1.LamaDrawService,
        lama_pass_service_1.LamaPassService,
        lama_play_service_1.LamaPlayService,
        lama_quit_service_1.LamaQuitService,
        lama_return_service_1.LamaReturnService,
        lama_info_service_1.LamaInfoService,
        lama_setup_service_1.LamaSetupService,
        lama_log_service_1.LamaLogService])
], LamaActionService);
//# sourceMappingURL=lama-action.service.js.map