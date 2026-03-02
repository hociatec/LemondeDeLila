"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ActionResolverService", {
    enumerable: true,
    get: function() {
        return ActionResolverService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let ActionResolverService = class ActionResolverService {
    /**
   * Applique en séquence une liste d'actions via un dispatcher fourni.
   */ apply(state, actions, dispatch) {
        let next = state;
        if (!Array.isArray(actions)) return next;
        for (const action of actions){
            if (!action?.type) continue;
            next = dispatch(next, action);
        }
        return next;
    }
};
ActionResolverService = _ts_decorate([
    (0, _common.Injectable)()
], ActionResolverService);
