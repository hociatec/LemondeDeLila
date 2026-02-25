"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RedisClientFactory", {
    enumerable: true,
    get: function() {
        return RedisClientFactory;
    }
});
const _common = require("@nestjs/common");
const _ioredis = /*#__PURE__*/ _interop_require_default(require("ioredis"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let RedisClientFactory = class RedisClientFactory {
    create(url, name, options) {
        const client = new _ioredis.default(url, options ?? {});
        client.on('error', (err)=>{
            this.logger.error(`[${name}] redis error`, err.stack ?? String(err));
        });
        return client;
    }
    constructor(){
        this.logger = new _common.Logger(RedisClientFactory.name);
    }
};
RedisClientFactory = _ts_decorate([
    (0, _common.Injectable)()
], RedisClientFactory);
