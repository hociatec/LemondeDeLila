"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LilaWsAdapter", {
    enumerable: true,
    get: function() {
        return LilaWsAdapter;
    }
});
const _platformws = require("@nestjs/platform-ws");
let LilaWsAdapter = class LilaWsAdapter extends _platformws.WsAdapter {
    create(port, options) {
        const merged = {
            ...options ?? {},
            perMessageDeflate: options?.perMessageDeflate ?? (process.env.WS_PERMESSAGE_DEFLATE || 'true').toLowerCase() === 'true'
        };
        return super.create(port, merged);
    }
};
