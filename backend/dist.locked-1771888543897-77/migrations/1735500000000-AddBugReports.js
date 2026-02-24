"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddBugReports1735500000000 = void 0;
const typeorm_1 = require("typeorm");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class AddBugReports1735500000000 {
    name = 'AddBugReports1735500000000';
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('bug_reports'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'bug_reports',
                columns: [
                    { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                    { name: 'subject', type: 'varchar', length: '200' },
                    { name: 'content', type: 'longtext' },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        default: "'pending'",
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'datetime',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                    { name: 'created_by_user_id', type: 'int' },
                    { name: 'created_by_username', type: 'varchar', length: '100' },
                ],
                indices: [
                    new typeorm_1.TableIndex({
                        name: 'idx_bug_reports_status',
                        columnNames: ['status'],
                    }),
                    new typeorm_1.TableIndex({
                        name: 'idx_bug_reports_created_at',
                        columnNames: ['created_at'],
                    }),
                ],
            }), true);
        }
        await this.seedFromLegacyJson(queryRunner);
    }
    async down(queryRunner) {
        await queryRunner.dropTable('bug_reports', true);
    }
    async seedFromLegacyJson(queryRunner) {
        const rows = (await queryRunner.query('SELECT COUNT(*) as c FROM bug_reports'));
        const count = Number(rows?.[0]?.c ?? 0);
        if (count > 0)
            return;
        const legacy = this.tryReadJson(this.dataPath('bug-reports.json'));
        const items = Array.isArray(legacy?.items) ? legacy.items : [];
        if (items.length === 0)
            return;
        for (const r of items) {
            if (!r?.id || !r.subject || !r.content)
                continue;
            const status = r.status === 'in_progress' || r.status === 'done'
                ? r.status
                : 'pending';
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
                String(r.createdByUsername || 'admin'),
            ]);
        }
    }
    dataPath(file) {
        return path.resolve(process.cwd(), 'data', file);
    }
    tryReadJson(filePath) {
        try {
            if (!fs.existsSync(filePath))
                return null;
            const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
            return JSON.parse(raw);
        }
        catch {
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
}
exports.AddBugReports1735500000000 = AddBugReports1735500000000;
//# sourceMappingURL=1735500000000-AddBugReports.js.map