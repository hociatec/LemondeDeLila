"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SocialWsRegistrar", {
    enumerable: true,
    get: function() {
        return SocialWsRegistrar;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("../../common/ws/ws-route-registry.service");
const _socialwshandler = require("./social-ws.handler");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let SocialWsRegistrar = class SocialWsRegistrar {
    onModuleInit() {
        this.registry.register('social.friends.list', (session, _payload)=>this.handler.listFriends(session));
        this.registry.register('social.friends.requests', (session, payload)=>this.handler.listRequests(session, payload));
        this.registry.register('social.friends.blocked', (session, _payload)=>this.handler.listBlocked(session));
        this.registry.register('social.friends.request', (session, payload)=>this.handler.requestFriend(session, payload));
        this.registry.register('social.friends.accept', (session, payload)=>this.handler.acceptFriend(session, payload));
        this.registry.register('social.friends.reject', (session, payload)=>this.handler.rejectFriend(session, payload));
        this.registry.register('social.friends.cancel', (session, payload)=>this.handler.cancelRequest(session, payload));
        this.registry.register('social.friends.remove', (session, payload)=>this.handler.removeFriend(session, payload));
        this.registry.register('social.friends.block', (session, payload)=>this.handler.blockFriend(session, payload));
        this.registry.register('social.friends.unblock', (session, payload)=>this.handler.unblockFriend(session, payload));
        this.registry.register('social.profile.get', (session, payload)=>this.handler.getProfile(session, payload));
        this.registry.register('social.profile.update', (session, payload)=>this.handler.updateProfile(session, payload));
        this.registry.register('social.user.search', (session, payload)=>this.handler.searchUsers(session, payload));
    }
    constructor(registry, handler){
        this.registry = registry;
        this.handler = handler;
    }
};
SocialWsRegistrar = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry,
        typeof _socialwshandler.SocialWsHandler === "undefined" ? Object : _socialwshandler.SocialWsHandler
    ])
], SocialWsRegistrar);
