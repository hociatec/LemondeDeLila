"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _os = /*#__PURE__*/ _interop_require_wildcard(require("os"));
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
describe('MnemoQuizStoreService persistence path', ()=>{
    const originalEnv = {
        NODE_ENV: process.env.NODE_ENV,
        MNEMO_QUIZ_PATH: process.env.MNEMO_QUIZ_PATH,
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE
    };
    const originalCwd = process.cwd();
    let tempRoot = '';
    let tempHome = '';
    beforeEach(()=>{
        tempRoot = _fs.mkdtempSync(_path.join(_os.tmpdir(), 'lmdl-mnemo-store-'));
        tempHome = _path.join(tempRoot, 'home');
        _fs.mkdirSync(tempHome, {
            recursive: true
        });
        process.chdir(tempRoot);
        process.env.NODE_ENV = 'production';
        delete process.env.MNEMO_QUIZ_PATH;
        process.env.HOME = tempHome;
        process.env.USERPROFILE = tempHome;
    });
    afterEach(()=>{
        process.chdir(originalCwd);
        process.env.NODE_ENV = originalEnv.NODE_ENV;
        process.env.MNEMO_QUIZ_PATH = originalEnv.MNEMO_QUIZ_PATH;
        process.env.HOME = originalEnv.HOME;
        process.env.USERPROFILE = originalEnv.USERPROFILE;
        jest.dontMock('os');
        jest.resetModules();
        try {
            _fs.rmSync(tempRoot, {
                recursive: true,
                force: true
            });
        } catch  {
        // ignore
        }
    });
    it('bootstraps from legacy path to persistent path in production', async ()=>{
        const legacyPath = _path.join(tempRoot, 'data', 'arche-de-mnemosyne', 'quiz.json');
        _fs.mkdirSync(_path.dirname(legacyPath), {
            recursive: true
        });
        _fs.writeFileSync(legacyPath, JSON.stringify({
            categories: [
                {
                    id: 'cat-a',
                    name: 'Categorie A'
                }
            ],
            questions: []
        }), 'utf-8');
        const service = await createServiceWithHome(tempHome);
        service.onModuleInit();
        const persistentPath = _path.join(tempHome, '.local', 'share', 'lemonde-de-lila', 'arche-de-mnemosyne', 'quiz.json');
        expect(_fs.existsSync(persistentPath)).toBe(true);
        const initial = JSON.parse(_fs.readFileSync(persistentPath, 'utf-8'));
        expect(initial.categories).toHaveLength(1);
        expect(initial.categories[0].name).toBe('Categorie A');
        service.createCategory('Categorie B');
        const updated = JSON.parse(_fs.readFileSync(persistentPath, 'utf-8'));
        expect(updated.categories.some((c)=>c.name === 'Categorie B')).toBe(true);
    });
    it('uses MNEMO_QUIZ_PATH override when provided', async ()=>{
        const customPath = _path.join(tempRoot, 'custom-data', 'quiz.json');
        process.env.MNEMO_QUIZ_PATH = customPath;
        const service = await createServiceWithHome(tempHome);
        service.onModuleInit();
        service.createCategory('Categorie personnalisee');
        expect(_fs.existsSync(customPath)).toBe(true);
        const data = JSON.parse(_fs.readFileSync(customPath, 'utf-8'));
        expect(data.categories.some((c)=>c.name === 'Categorie personnalisee')).toBe(true);
    });
    async function createServiceWithHome(homePath) {
        jest.resetModules();
        jest.doMock('os', ()=>{
            const actual = jest.requireActual('os');
            return {
                ...actual,
                homedir: ()=>homePath
            };
        });
        const mod = await Promise.resolve().then(()=>/*#__PURE__*/ _interop_require_wildcard(require("../store/mnemo-quiz-store.service")));
        return new mod.MnemoQuizStoreService();
    }
});
