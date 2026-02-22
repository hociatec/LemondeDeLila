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
exports.ImportLegacySettingsJson1735900000000 = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function safeParseJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath))
            return null;
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function normalizeProfile(input) {
    const min = Number.isFinite(input.bioMinLength)
        ? Math.max(0, Math.floor(input.bioMinLength))
        : 0;
    const max = Number.isFinite(input.bioMaxLength)
        ? Math.max(0, Math.min(100000, Math.floor(input.bioMaxLength)))
        : 500;
    const clampedMin = Math.min(min, max);
    return { bioMinLength: clampedMin, bioMaxLength: max };
}
function normalizeRoom(input) {
    const enabled = input.autoCleanupEnabled === true;
    const interval = Number.isFinite(input.autoCleanupIntervalSeconds)
        ? Math.max(30, Math.floor(input.autoCleanupIntervalSeconds))
        : 300;
    const older = Number.isFinite(input.autoCleanupOlderThanMinutes)
        ? Math.max(5, Math.floor(input.autoCleanupOlderThanMinutes))
        : 60;
    const limit = Number.isFinite(input.autoCleanupLimit)
        ? Math.max(1, Math.min(5000, Math.floor(input.autoCleanupLimit)))
        : 1000;
    return {
        autoCleanupEnabled: enabled,
        autoCleanupIntervalSeconds: interval,
        autoCleanupOlderThanMinutes: older,
        autoCleanupLimit: limit,
    };
}
class ImportLegacySettingsJson1735900000000 {
    name = 'ImportLegacySettingsJson1735900000000';
    async up(queryRunner) {
        const dataDir = path.join(process.cwd(), 'data');
        const profilePath = path.join(dataDir, 'social-profile-settings.json');
        const roomPath = path.join(dataDir, 'room-maintenance.json');
        if (await queryRunner.hasTable('social_profile_settings')) {
            const legacy = safeParseJsonFile(profilePath);
            if (legacy) {
                const normalized = normalizeProfile(legacy);
                const rows = (await queryRunner.query('SELECT bio_min_length as bioMinLength, bio_max_length as bioMaxLength FROM social_profile_settings WHERE id = 1 LIMIT 1'));
                if (rows.length === 0) {
                    await queryRunner.query('INSERT INTO social_profile_settings (id, bio_min_length, bio_max_length) VALUES (1, ?, ?)', [normalized.bioMinLength, normalized.bioMaxLength]);
                }
                else {
                    const current = rows[0];
                    const isDefault = current.bioMinLength === 0 && current.bioMaxLength === 500;
                    if (isDefault) {
                        await queryRunner.query('UPDATE social_profile_settings SET bio_min_length = ?, bio_max_length = ? WHERE id = 1', [normalized.bioMinLength, normalized.bioMaxLength]);
                    }
                }
            }
        }
        if (await queryRunner.hasTable('room_maintenance_settings')) {
            const legacy = safeParseJsonFile(roomPath);
            if (legacy) {
                const normalized = normalizeRoom(legacy);
                const rows = (await queryRunner.query(`SELECT
            auto_cleanup_enabled as autoCleanupEnabled,
            auto_cleanup_older_than_minutes as autoCleanupOlderThanMinutes,
            auto_cleanup_interval_seconds as autoCleanupIntervalSeconds,
            auto_cleanup_limit as autoCleanupLimit
           FROM room_maintenance_settings
           WHERE id = 1
           LIMIT 1`));
                if (rows.length === 0) {
                    await queryRunner.query(`INSERT INTO room_maintenance_settings
              (id, auto_cleanup_enabled, auto_cleanup_older_than_minutes, auto_cleanup_interval_seconds, auto_cleanup_limit)
             VALUES (1, ?, ?, ?, ?)`, [
                        normalized.autoCleanupEnabled,
                        normalized.autoCleanupOlderThanMinutes,
                        normalized.autoCleanupIntervalSeconds,
                        normalized.autoCleanupLimit,
                    ]);
                }
                else {
                    const current = rows[0];
                    const currentEnabled = current.autoCleanupEnabled === true ||
                        current.autoCleanupEnabled === 1;
                    const isDefault = currentEnabled === false &&
                        current.autoCleanupOlderThanMinutes === 60 &&
                        current.autoCleanupIntervalSeconds === 300 &&
                        current.autoCleanupLimit === 1000;
                    if (isDefault) {
                        await queryRunner.query(`UPDATE room_maintenance_settings
               SET
                 auto_cleanup_enabled = ?,
                 auto_cleanup_older_than_minutes = ?,
                 auto_cleanup_interval_seconds = ?,
                 auto_cleanup_limit = ?
               WHERE id = 1`, [
                            normalized.autoCleanupEnabled,
                            normalized.autoCleanupOlderThanMinutes,
                            normalized.autoCleanupIntervalSeconds,
                            normalized.autoCleanupLimit,
                        ]);
                    }
                }
            }
        }
    }
    async down(_queryRunner) {
    }
}
exports.ImportLegacySettingsJson1735900000000 = ImportLegacySettingsJson1735900000000;
//# sourceMappingURL=1735900000000-ImportLegacySettingsJson.js.map