"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AbsurdissimesDeckService", {
    enumerable: true,
    get: function() {
        return AbsurdissimesDeckService;
    }
});
const _common = require("@nestjs/common");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AbsurdissimesDeckService = class AbsurdissimesDeckService {
    getWhiteCards() {
        return [
            ...this.whiteCards
        ];
    }
    getBlackCards() {
        return [
            ...this.blackCards
        ];
    }
    loadCards(fileName) {
        const filePath = this.resolveDataPath(fileName);
        if (!filePath) {
            this.logger.error(`Fichier de cartes introuvable : ${fileName}`);
            return [];
        }
        try {
            const raw = _fs.readFileSync(filePath, 'utf-8');
            return this.parseCards(raw);
        } catch (error) {
            this.logger.error(`Impossible de lire ${fileName} : ${error?.message ?? 'erreur inconnue'}`);
            return [];
        }
    }
    resolveDataPath(fileName) {
        const candidates = [
            _path.resolve(__dirname, 'data', fileName),
            _path.resolve(process.cwd(), 'src', 'game', 'games', 'vents-dansants', 'les-absurdissimes', 'data', fileName),
            _path.resolve(process.cwd(), 'dist', 'game', 'games', 'vents-dansants', 'les-absurdissimes', 'data', fileName)
        ];
        for (const candidate of candidates){
            if (_fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return null;
    }
    parseCards(content) {
        const cards = [];
        const regex = /(\d+)\.\s*[\r\n]+([\s\S]*?)(?=\n\d+\.|$)/g;
        let match;
        while(match = regex.exec(content)){
            const raw = match[2].trim();
            if (raw) {
                const normalized = raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
                cards.push(normalized);
            }
        }
        return cards;
    }
    constructor(){
        this.logger = new _common.Logger(AbsurdissimesDeckService.name);
        this.whiteCards = this.loadCards('white-cards.txt');
        this.blackCards = this.loadCards('black-cards.txt');
    }
};
AbsurdissimesDeckService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [])
], AbsurdissimesDeckService);
