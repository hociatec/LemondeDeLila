"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WsRouteRegistry", {
    enumerable: true,
    get: function() {
        return WsRouteRegistry;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let WsRouteRegistry = class WsRouteRegistry {
    register(type, handler) {
        if (!type || type.trim() === '') {
            throw new Error('WS route type requis');
        }
        if (this.routes.has(type)) {
            throw new Error(`WS route déjà enregistrée: ${type}`);
        }
        this.routes.set(type, handler);
    }
    get(type) {
        return this.routes.get(type);
    }
    has(type) {
        return this.routes.has(type);
    }
    listTypes() {
        return Array.from(this.routes.keys()).sort((a, b)=>a.localeCompare(b));
    }
    constructor(){
        this.routes = new Map();
    }
};
WsRouteRegistry = _ts_decorate([
    (0, _common.Injectable)()
], WsRouteRegistry);
