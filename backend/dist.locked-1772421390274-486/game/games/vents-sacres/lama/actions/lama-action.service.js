"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaActionService", {
    enumerable: true,
    get: function() {
        return LamaActionService;
    }
});
const _common = require("@nestjs/common");
const _lamasharedservice = require("../shared/lama-shared.service");
const _lamadrawservice = require("./lama-draw.service");
const _lamapassservice = require("./lama-pass.service");
const _lamaplayservice = require("./lama-play.service");
const _lamaquitservice = require("./lama-quit.service");
const _lamareturnservice = require("./lama-return.service");
const _lamainfoservice = require("./lama-info.service");
const _lamasetupservice = require("../setup/lama-setup.service");
const _lamalogservice = require("../logging/lama-log.service");
const _actionservicehelper = require("../../../../actions/action-service.helper");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LamaActionService = class LamaActionService {
    applyActions(state, actions) {
        return (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>{
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
        if (prevPlayerId == null || nextPlayerId == null || prevPlayerId === nextPlayerId) {
            return next;
        }
        const players = Array.isArray(next.players) ? next.players : [];
        const name = this.shared.playerLabel(players, nextPlayerId);
        const message = `C'est au tour de ${name}.`;
        const log = this.logger.append(next.log, message);
        const meta = {
            ...next.metadata ?? {}
        };
        return {
            ...next,
            log,
            metadata: {
                ...meta,
                suppressTurnAnnouncement: true
            }
        };
    }
    applyOne(state, action) {
        const type = (0, _actionservicehelper.normalizeActionType)(action);
        if (!type) return state;
        const actorId = typeof action?.meta?.actorId === 'number' ? action.meta.actorId : state.turn?.currentPlayerId ?? null;
        if (!actorId) return state;
        const meta = {
            ...state.metadata ?? {}
        };
        if (meta.winnerId) return state;
        const players = Array.isArray(state.players) ? state.players : [];
        const status = String(state.status ?? '').toLowerCase();
        if (type === 'lama_peek_discard' || type === 'lama_preview') {
            return this.infoService.applyInfoAction(state, meta, type, actorId);
        }
        if ((meta.step ?? '') === 'setup_config') {
            if (type !== 'lama_set_config') return state;
            return this.setupService.applySetupConfig(state, meta, action, actorId);
        }
        if ((meta.step ?? '') === 'round_pause') {
            if (type !== 'lama_resume_round') return state;
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
            if (meta.droppedOutByPlayerId?.[String(actorId)]) return state;
            try {
                const current = players.find((p)=>p?.id === actorId);
                const isBot = Boolean(current?.isBot);
                const tracker = metaForTurn.turnTracker ?? null;
                const lastDrawMap = metaForTurn?.lastDrawTurnIndexByPlayerId ?? null;
                const lastDrawIndex = lastDrawMap && typeof lastDrawMap === 'object' ? this.shared.asNumberOrNull(lastDrawMap[String(actorId)]) : null;
                const justDrew = lastDrawIndex != null && lastDrawIndex === Number(state.turnIndex ?? 0);
                const alreadyDrawn = this.shared.asNumberOrNull(tracker?.playerId) === actorId && this.shared.asBoolean(tracker?.drawn);
                if (isBot && !alreadyDrawn) {
                    const name = this.shared.playerLabel(players, actorId);
                    if (!justDrew) {
                        const logWithWarning = this.logger.append(state.log, `${name} doit piocher.`);
                        return this.drawService.applyDraw({
                            ...state,
                            log: logWithWarning
                        }, metaForTurn, actorId);
                    }
                    return this.drawService.applyDraw(state, metaForTurn, actorId);
                }
            } catch  {
            // ignore
            }
            return this.drawService.applyDraw(state, metaForTurn, actorId);
        }
        if (type === 'lama_quit') {
            return this.quitService.applyQuit(state, metaForTurn, actorId);
        }
        if (type === 'lama_pass') {
            // Official LAMA rule: "pass" means leaving the round.
            // Keep backward compatibility for older clients still sending lama_pass.
            return this.quitService.applyQuit(state, metaForTurn, actorId);
        }
        if (type === 'lama_play') {
            if (meta.droppedOutByPlayerId[String(actorId)]) return state;
            return this.playService.applyPlay(state, metaForTurn, actorId, action);
        }
        return state;
    }
    constructor(shared, drawService, _passService, playService, quitService, returnService, infoService, setupService, logger){
        this.shared = shared;
        this.drawService = drawService;
        this.playService = playService;
        this.quitService = quitService;
        this.returnService = returnService;
        this.infoService = infoService;
        this.setupService = setupService;
        this.logger = logger;
    }
};
LamaActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService,
        typeof _lamadrawservice.LamaDrawService === "undefined" ? Object : _lamadrawservice.LamaDrawService,
        typeof _lamapassservice.LamaPassService === "undefined" ? Object : _lamapassservice.LamaPassService,
        typeof _lamaplayservice.LamaPlayService === "undefined" ? Object : _lamaplayservice.LamaPlayService,
        typeof _lamaquitservice.LamaQuitService === "undefined" ? Object : _lamaquitservice.LamaQuitService,
        typeof _lamareturnservice.LamaReturnService === "undefined" ? Object : _lamareturnservice.LamaReturnService,
        typeof _lamainfoservice.LamaInfoService === "undefined" ? Object : _lamainfoservice.LamaInfoService,
        typeof _lamasetupservice.LamaSetupService === "undefined" ? Object : _lamasetupservice.LamaSetupService,
        typeof _lamalogservice.LamaLogService === "undefined" ? Object : _lamalogservice.LamaLogService
    ])
], LamaActionService);
