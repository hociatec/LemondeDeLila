"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurnPoliciesModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../core/core.module");
const turn_policies_service_1 = require("./services/turn-policies.service");
let TurnPoliciesModule = class TurnPoliciesModule {
};
exports.TurnPoliciesModule = TurnPoliciesModule;
exports.TurnPoliciesModule = TurnPoliciesModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => core_module_1.GameCoreModule)],
        providers: [turn_policies_service_1.TurnPoliciesService],
        exports: [turn_policies_service_1.TurnPoliciesService],
    })
], TurnPoliciesModule);
//# sourceMappingURL=turn-policies.module.js.map