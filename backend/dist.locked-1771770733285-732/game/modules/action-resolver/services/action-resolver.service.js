"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionResolverService = void 0;
const common_1 = require("@nestjs/common");
let ActionResolverService = class ActionResolverService {
    apply(state, actions, dispatch) {
        let next = state;
        if (!Array.isArray(actions))
            return next;
        for (const action of actions) {
            if (!action?.type)
                continue;
            next = dispatch(next, action);
        }
        return next;
    }
};
exports.ActionResolverService = ActionResolverService;
exports.ActionResolverService = ActionResolverService = __decorate([
    (0, common_1.Injectable)()
], ActionResolverService);
//# sourceMappingURL=action-resolver.service.js.map