"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionResolverModule = void 0;
const common_1 = require("@nestjs/common");
const action_resolver_service_1 = require("./services/action-resolver.service");
let ActionResolverModule = class ActionResolverModule {
};
exports.ActionResolverModule = ActionResolverModule;
exports.ActionResolverModule = ActionResolverModule = __decorate([
    (0, common_1.Module)({
        providers: [action_resolver_service_1.ActionResolverService],
        exports: [action_resolver_service_1.ActionResolverService],
    })
], ActionResolverModule);
//# sourceMappingURL=action-resolver.module.js.map