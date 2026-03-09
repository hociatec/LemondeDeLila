"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RolesAssignmentService", {
    enumerable: true,
    get: function() {
        return RolesAssignmentService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let RolesAssignmentService = class RolesAssignmentService {
    assign(playerIds, prioritizedRoles, defaultRole, rng = Math.random) {
        const ids = [
            ...playerIds
        ].filter((id)=>typeof id === 'number');
        this.shuffle(ids, rng);
        const roles = {};
        ids.forEach((id, idx)=>{
            roles[id] = prioritizedRoles[idx] ?? defaultRole;
        });
        return roles;
    }
    shuffle(array, rng) {
        for(let i = array.length - 1; i > 0; i--){
            const j = Math.floor(rng() * (i + 1));
            [array[i], array[j]] = [
                array[j],
                array[i]
            ];
        }
    }
};
RolesAssignmentService = _ts_decorate([
    (0, _common.Injectable)()
], RolesAssignmentService);
