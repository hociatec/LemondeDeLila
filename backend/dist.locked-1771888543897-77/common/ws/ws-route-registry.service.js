"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsRouteRegistry = void 0;
const common_1 = require("@nestjs/common");
let WsRouteRegistry = class WsRouteRegistry {
    routes = new Map();
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
        return Array.from(this.routes.keys()).sort((a, b) => a.localeCompare(b));
    }
};
exports.WsRouteRegistry = WsRouteRegistry;
exports.WsRouteRegistry = WsRouteRegistry = __decorate([
    (0, common_1.Injectable)()
], WsRouteRegistry);
//# sourceMappingURL=ws-route-registry.service.js.map