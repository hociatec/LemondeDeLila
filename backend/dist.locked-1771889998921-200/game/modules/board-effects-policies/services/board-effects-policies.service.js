"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoardEffectsPoliciesService = void 0;
const common_1 = require("@nestjs/common");
const game_log_text_helper_1 = require("../../../core/helpers/game-log-text.helper");
const string_value_utils_1 = require("../../../../common/utils/string-value.utils");
let BoardEffectsPoliciesService = class BoardEffectsPoliciesService {
    formatTileLabel(position, rawLabel) {
        const label = (0, string_value_utils_1.stringOrEmpty)(rawLabel).trim();
        if (!label)
            return `Case ${position + 1}`;
        if (/^(case|depart|arrivee)\b/i.test(label))
            return label;
        return `Case ${position + 1} - ${label}`;
    }
    createPlacementLog(params) {
        return (0, game_log_text_helper_1.pawnPlacement)(params);
    }
    resolveLanding(params) {
        const logs = [];
        const tile = params.tile ?? null;
        const type = (0, string_value_utils_1.stringOrEmpty)(tile?.type).trim().toLowerCase();
        const description = (0, string_value_utils_1.stringOrEmpty)(tile?.description).trim();
        if (description) {
            logs.push(description);
        }
        else if (params.defaultNeutralLog) {
            logs.push((0, string_value_utils_1.stringOrEmpty)(params.defaultNeutralLog).trim());
        }
        const finishTypes = (params.finishTypes ?? ['finish']).map((value) => (0, string_value_utils_1.stringOrEmpty)(value).trim().toLowerCase());
        if (finishTypes.includes(type)) {
            return { logs, pending: null, isFinish: true };
        }
        const drawPolicy = params.drawPolicies?.[type];
        if (!drawPolicy) {
            return { logs, pending: null, isFinish: false };
        }
        logs.push(drawPolicy.log);
        const pending = {
            type: 'draw',
            playerId: params.playerId,
            blocking: true,
            label: drawPolicy.pendingLabel,
            data: drawPolicy.data ?? {},
        };
        return { logs, pending, isFinish: false };
    }
};
exports.BoardEffectsPoliciesService = BoardEffectsPoliciesService;
exports.BoardEffectsPoliciesService = BoardEffectsPoliciesService = __decorate([
    (0, common_1.Injectable)()
], BoardEffectsPoliciesService);
//# sourceMappingURL=board-effects-policies.service.js.map