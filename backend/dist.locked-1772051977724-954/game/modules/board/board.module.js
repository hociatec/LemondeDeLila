"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BoardModule", {
    enumerable: true,
    get: function() {
        return BoardModule;
    }
});
const _common = require("@nestjs/common");
const _boardservice = require("./services/board.service");
const _boardmovementservice = require("./services/board-movement.service");
const _boardpayloadservice = require("./services/board-payload.service");
const _gamemoduleoverviewconstants = require("../game-module-overview.constants");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
const boardOverviewProvider = {
    provide: _gamemoduleoverviewconstants.GAME_MODULE_OVERVIEW,
    useExisting: _boardservice.BoardService
};
let BoardModule = class BoardModule {
};
BoardModule = _ts_decorate([
    (0, _common.Module)({
        providers: [
            _boardservice.BoardService,
            _boardmovementservice.BoardMovementService,
            _boardpayloadservice.BoardPayloadService,
            boardOverviewProvider
        ],
        exports: [
            _boardservice.BoardService,
            _boardmovementservice.BoardMovementService,
            _boardpayloadservice.BoardPayloadService,
            boardOverviewProvider
        ]
    })
], BoardModule);
