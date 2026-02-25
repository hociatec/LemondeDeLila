"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LilaWsAdapter = void 0;
const platform_ws_1 = require("@nestjs/platform-ws");
class LilaWsAdapter extends platform_ws_1.WsAdapter {
    create(port, options) {
        const merged = {
            ...(options ?? {}),
            perMessageDeflate: options?.perMessageDeflate ??
                (process.env.WS_PERMESSAGE_DEFLATE || 'true').toLowerCase() === 'true',
        };
        return super.create(port, merged);
    }
}
exports.LilaWsAdapter = LilaWsAdapter;
//# sourceMappingURL=lila-ws.adapter.js.map