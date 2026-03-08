"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BoardEffectsPoliciesService", {
    enumerable: true,
    get: function() {
        return BoardEffectsPoliciesService;
    }
});
const _common = require("@nestjs/common");
const _gamelogtexthelper = require("../../../core/helpers/game-log-text.helper");
const _stringvalueutils = require("../../../../common/utils/string-value.utils");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let BoardEffectsPoliciesService = class BoardEffectsPoliciesService {
    formatTileLabel(position, rawLabel) {
        const label = (0, _stringvalueutils.stringOrEmpty)(rawLabel).trim();
        if (!label) return `Case ${position + 1}`;
        if (/^(case|depart|arrivee)\b/i.test(label)) return label;
        return `Case ${position + 1} - ${label}`;
    }
    createPlacementLog(params) {
        return (0, _gamelogtexthelper.pawnPlacement)(params);
    }
    resolveLanding(params) {
        const logs = [];
        const tile = params.tile ?? null;
        const type = (0, _stringvalueutils.stringOrEmpty)(tile?.type).trim().toLowerCase();
        const description = (0, _stringvalueutils.stringOrEmpty)(tile?.description).trim();
        if (description) {
            logs.push(description);
        } else if (params.defaultNeutralLog) {
            logs.push((0, _stringvalueutils.stringOrEmpty)(params.defaultNeutralLog).trim());
        }
        const finishTypes = (params.finishTypes ?? [
            'finish'
        ]).map((value)=>(0, _stringvalueutils.stringOrEmpty)(value).trim().toLowerCase());
        if (finishTypes.includes(type)) {
            return {
                logs,
                pending: null,
                isFinish: true
            };
        }
        const drawPolicy = params.drawPolicies?.[type];
        if (!drawPolicy) {
            return {
                logs,
                pending: null,
                isFinish: false
            };
        }
        logs.push(drawPolicy.log);
        const pending = {
            type: 'draw',
            playerId: params.playerId,
            blocking: true,
            label: drawPolicy.pendingLabel,
            data: drawPolicy.data ?? {}
        };
        return {
            logs,
            pending,
            isFinish: false
        };
    }
};
BoardEffectsPoliciesService = _ts_decorate([
    (0, _common.Injectable)()
], BoardEffectsPoliciesService);
