"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _os = /*#__PURE__*/ _interop_require_wildcard(require("os"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _mnemoquizstoreservice = require("../store/mnemo-quiz-store.service");
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
describe('MnemoQuizStoreService CRUD', ()=>{
    const originalPath = process.env.MNEMO_QUIZ_PATH;
    let tempRoot = '';
    let filePath = '';
    beforeEach(()=>{
        tempRoot = _fs.mkdtempSync(_path.join(_os.tmpdir(), 'mnemo-store-crud-'));
        filePath = _path.join(tempRoot, 'quiz.json');
        process.env.MNEMO_QUIZ_PATH = filePath;
    });
    afterEach(()=>{
        process.env.MNEMO_QUIZ_PATH = originalPath;
        try {
            _fs.rmSync(tempRoot, {
                recursive: true,
                force: true
            });
        } catch  {
        // ignore
        }
    });
    it('initializes empty storage and persists default file', ()=>{
        const store = new _mnemoquizstoreservice.MnemoQuizStoreService();
        store.onModuleInit();
        expect(_fs.existsSync(filePath)).toBe(true);
        expect(store.getSnapshot().categories).toEqual([]);
        expect(store.getSnapshot().questions).toEqual([]);
    });
    it('handles category lifecycle and unique slug generation', ()=>{
        const store = new _mnemoquizstoreservice.MnemoQuizStoreService();
        store.onModuleInit();
        const a = store.createCategory('Histoire');
        const b = store.createCategory('Histoire');
        expect(a.id).toBe('histoire');
        expect(b.id).toBe('histoire-1');
        const renamed = store.renameCategory(a.id, 'Histoire Mondiale');
        expect(renamed.name).toBe('Histoire Mondiale');
        expect(()=>store.renameCategory('missing', 'x')).toThrow();
        expect(()=>store.deleteCategory('missing')).toThrow();
    });
    it('handles question lifecycle, filters and delete/trash behavior', ()=>{
        const store = new _mnemoquizstoreservice.MnemoQuizStoreService();
        store.onModuleInit();
        const category = store.createCategory('Sciences');
        const q1 = store.createQuestion({
            categoryId: category.id,
            question: 'Q1',
            correct: 'A',
            wrong1: 'B',
            wrong2: 'C',
            wrong3: 'D',
            status: 'validated'
        });
        const q2 = store.createQuestion({
            categoryId: category.id,
            question: 'Q2',
            correct: 'A2',
            wrong1: 'B2',
            wrong2: 'C2',
            wrong3: 'D2',
            status: 'pending'
        });
        expect(store.listQuestions({
            categoryId: category.id
        }).length).toBe(2);
        expect(store.listQuestions({
            status: 'pending'
        }).map((q)=>q.id)).toContain(q2.id);
        const updated = store.updateQuestion(q1.id, {
            question: 'Q1 bis',
            status: 'to_edit'
        });
        expect(updated.question).toBe('Q1 bis');
        expect(updated.status).toBe('to_edit');
        expect(()=>store.updateQuestion('missing', {
                question: 'x'
            })).toThrow();
        expect(()=>store.deleteQuestion('missing')).toThrow();
        store.deleteQuestion(q2.id);
        expect(store.listQuestions().some((q)=>q.id === q2.id)).toBe(false);
        store.deleteCategory(category.id);
        const trashed = store.listQuestions().find((q)=>q.id === q1.id);
        expect(trashed?.status).toBe('trash');
    });
    it('rejects invalid payloads and recovers from corrupted json', ()=>{
        const store = new _mnemoquizstoreservice.MnemoQuizStoreService();
        store.onModuleInit();
        const category = store.createCategory('Culture');
        expect(()=>store.createCategory('')).toThrow();
        expect(()=>store.createQuestion({
                categoryId: '',
                question: 'Q',
                correct: 'A',
                wrong1: 'B',
                wrong2: 'C',
                wrong3: 'D'
            })).toThrow();
        expect(()=>store.createQuestion({
                categoryId: category.id,
                question: '',
                correct: 'A',
                wrong1: 'B',
                wrong2: 'C',
                wrong3: 'D'
            })).toThrow();
        _fs.writeFileSync(filePath, '{invalid json', 'utf-8');
        const recovered = new _mnemoquizstoreservice.MnemoQuizStoreService();
        recovered.onModuleInit();
        expect(recovered.getSnapshot().categories).toEqual([]);
    });
});
