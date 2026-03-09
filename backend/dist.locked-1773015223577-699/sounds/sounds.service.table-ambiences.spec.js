"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _common = require("@nestjs/common");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _os = /*#__PURE__*/ _interop_require_wildcard(require("os"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _soundsservice = require("./sounds.service");
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
describe('SoundsService table ambiences', ()=>{
    const originalEnv = {
        LMDL_SOUNDS_DIR: process.env.LMDL_SOUNDS_DIR,
        NODE_ENV: process.env.NODE_ENV
    };
    let tempRoot = '';
    beforeEach(()=>{
        tempRoot = _fs.mkdtempSync(_path.join(_os.tmpdir(), 'lmdl-sounds-test-'));
        process.env.LMDL_SOUNDS_DIR = tempRoot;
        process.env.NODE_ENV = 'test';
    });
    afterEach(()=>{
        process.env.LMDL_SOUNDS_DIR = originalEnv.LMDL_SOUNDS_DIR;
        process.env.NODE_ENV = originalEnv.NODE_ENV;
        try {
            _fs.rmSync(tempRoot, {
                recursive: true,
                force: true
            });
        } catch  {
        // ignore
        }
    });
    function createService() {
        const notifications = {
            notifyAll: jest.fn().mockResolvedValue(undefined)
        };
        const service = new _soundsservice.SoundsService(notifications);
        return {
            service,
            notifications
        };
    }
    it('defaults legacy entries to enabled=true and filters disabled in public list', async ()=>{
        const tableAmbiencesPath = _path.join(tempRoot, 'table-ambiences.json');
        _fs.writeFileSync(tableAmbiencesPath, JSON.stringify({
            updatedAt: '2026-03-01T00:00:00.000Z',
            items: [
                {
                    soundId: 'TableAmbience1',
                    name: 'Ambiance legacy sans flag'
                },
                {
                    soundId: 'TableAmbience2',
                    name: 'Ambiance inactive',
                    enabled: false
                }
            ]
        }), 'utf-8');
        const { service } = createService();
        const all = await service.listTableAmbiencesWithFilter({
            includeDisabled: true
        });
        expect(all.items).toEqual([
            {
                soundId: 'TableAmbience1',
                name: 'Ambiance legacy sans flag',
                enabled: true
            },
            {
                soundId: 'TableAmbience2',
                name: 'Ambiance inactive',
                enabled: false
            }
        ]);
        const publicList = await service.listTableAmbiencesWithFilter();
        expect(publicList.items).toEqual([
            {
                soundId: 'TableAmbience1',
                name: 'Ambiance legacy sans flag',
                enabled: true
            }
        ]);
    });
    it('keeps enabled flag when renaming and allows enable/disable toggles', async ()=>{
        const { service, notifications } = createService();
        await service.createTableAmbience('Ambiance 1');
        const disabled = await service.setTableAmbienceEnabled('TableAmbience1', false);
        expect(disabled.enabled).toBe(false);
        const renamed = await service.renameTableAmbience('TableAmbience1', 'Ambiance 1 renommee');
        expect(renamed.enabled).toBe(false);
        const hiddenFromPublic = await service.listTableAmbiencesWithFilter();
        expect(hiddenFromPublic.items).toHaveLength(0);
        const reenabled = await service.setTableAmbienceEnabled('TableAmbience1', true);
        expect(reenabled.enabled).toBe(true);
        const visibleInPublic = await service.listTableAmbiencesWithFilter();
        expect(visibleInPublic.items).toEqual([
            {
                soundId: 'TableAmbience1',
                name: 'Ambiance 1 renommee',
                enabled: true
            }
        ]);
        expect(notifications.notifyAll).toHaveBeenCalled();
    });
    it('enforces max 20 table ambiences', async ()=>{
        const { service } = createService();
        for(let i = 1; i <= 20; i++){
            await service.createTableAmbience(`Ambiance ${i}`);
        }
        await expect(service.createTableAmbience('Ambiance overflow')).rejects.toBeInstanceOf(_common.BadRequestException);
    });
});
