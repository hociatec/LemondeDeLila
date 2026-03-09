"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AddBugReports1735500000000", {
    enumerable: true,
    get: function() {
        return AddBugReports1735500000000;
    }
});
const _typeorm = require("typeorm");
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
let AddBugReports1735500000000 = class AddBugReports1735500000000 {
    async up(queryRunner) {
        if (!await queryRunner.hasTable('bug_reports')) {
            await queryRunner.createTable(new _typeorm.Table({
                name: 'bug_reports',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        length: '36',
                        isPrimary: true
                    },
                    {
                        name: 'subject',
                        type: 'varchar',
                        length: '200'
                    },
                    {
                        name: 'content',
                        type: 'longtext'
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        default: "'pending'"
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'updated_at',
                        type: 'datetime',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'created_by_user_id',
                        type: 'int'
                    },
                    {
                        name: 'created_by_username',
                        type: 'varchar',
                        length: '100'
                    }
                ],
                indices: [
                    new _typeorm.TableIndex({
                        name: 'idx_bug_reports_status',
                        columnNames: [
                            'status'
                        ]
                    }),
                    new _typeorm.TableIndex({
                        name: 'idx_bug_reports_created_at',
                        columnNames: [
                            'created_at'
                        ]
                    })
                ]
            }), true);
        }
        await this.seedFromLegacyJson(queryRunner);
    }
    async down(queryRunner) {
        await queryRunner.dropTable('bug_reports', true);
    }
    async seedFromLegacyJson(queryRunner) {
        const rows = await queryRunner.query('SELECT COUNT(*) as c FROM bug_reports');
        const count = Number(rows?.[0]?.c ?? 0);
        if (count > 0) return;
        const legacy = this.tryReadJson(this.dataPath('bug-reports.json'));
        const items = Array.isArray(legacy?.items) ? legacy.items : [];
        if (items.length === 0) return;
        for (const r of items){
            if (!r?.id || !r.subject || !r.content) continue;
            const status = r.status === 'in_progress' || r.status === 'done' ? r.status : 'pending';
            await queryRunner.query(`INSERT INTO bug_reports
          (id, subject, content, status, created_at, updated_at, created_by_user_id, created_by_username)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                r.id,
                r.subject,
                r.content,
                status,
                this.safeDate(r.createdAt),
                this.safeDate(r.updatedAt),
                Number(r.createdByUserId || 0),
                String(r.createdByUsername || 'admin')
            ]);
        }
    }
    dataPath(file) {
        return _path.resolve(process.cwd(), 'data', file);
    }
    tryReadJson(filePath) {
        try {
            if (!_fs.existsSync(filePath)) return null;
            const raw = _fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
            return JSON.parse(raw);
        } catch  {
            return null;
        }
    }
    safeDate(value) {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) {
            return new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
        return d.toISOString().slice(0, 19).replace('T', ' ');
    }
    constructor(){
        this.name = 'AddBugReports1735500000000';
    }
};
