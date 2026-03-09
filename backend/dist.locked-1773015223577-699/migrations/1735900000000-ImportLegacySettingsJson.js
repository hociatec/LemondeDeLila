"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ImportLegacySettingsJson1735900000000", {
    enumerable: true,
    get: function() {
        return ImportLegacySettingsJson1735900000000;
    }
});
const _nodefs = /*#__PURE__*/ _interop_require_wildcard(require("node:fs"));
const _nodepath = /*#__PURE__*/ _interop_require_wildcard(require("node:path"));
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
function safeParseJsonFile(filePath) {
    try {
        if (!_nodefs.existsSync(filePath)) return null;
        const raw = _nodefs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch  {
        return null;
    }
}
function normalizeProfile(input) {
    const min = Number.isFinite(input.bioMinLength) ? Math.max(0, Math.floor(input.bioMinLength)) : 0;
    const max = Number.isFinite(input.bioMaxLength) ? Math.max(0, Math.min(100000, Math.floor(input.bioMaxLength))) : 500;
    const clampedMin = Math.min(min, max);
    return {
        bioMinLength: clampedMin,
        bioMaxLength: max
    };
}
function normalizeRoom(input) {
    const enabled = input.autoCleanupEnabled === true;
    const interval = Number.isFinite(input.autoCleanupIntervalSeconds) ? Math.max(30, Math.floor(input.autoCleanupIntervalSeconds)) : 300;
    const older = Number.isFinite(input.autoCleanupOlderThanMinutes) ? Math.max(5, Math.floor(input.autoCleanupOlderThanMinutes)) : 60;
    const limit = Number.isFinite(input.autoCleanupLimit) ? Math.max(1, Math.min(5000, Math.floor(input.autoCleanupLimit))) : 1000;
    return {
        autoCleanupEnabled: enabled,
        autoCleanupIntervalSeconds: interval,
        autoCleanupOlderThanMinutes: older,
        autoCleanupLimit: limit
    };
}
let ImportLegacySettingsJson1735900000000 = class ImportLegacySettingsJson1735900000000 {
    async up(queryRunner) {
        const dataDir = _nodepath.join(process.cwd(), 'data');
        const profilePath = _nodepath.join(dataDir, 'social-profile-settings.json');
        const roomPath = _nodepath.join(dataDir, 'room-maintenance.json');
        if (await queryRunner.hasTable('social_profile_settings')) {
            const legacy = safeParseJsonFile(profilePath);
            if (legacy) {
                const normalized = normalizeProfile(legacy);
                const rows = await queryRunner.query('SELECT bio_min_length as bioMinLength, bio_max_length as bioMaxLength FROM social_profile_settings WHERE id = 1 LIMIT 1');
                if (rows.length === 0) {
                    await queryRunner.query('INSERT INTO social_profile_settings (id, bio_min_length, bio_max_length) VALUES (1, ?, ?)', [
                        normalized.bioMinLength,
                        normalized.bioMaxLength
                    ]);
                } else {
                    const current = rows[0];
                    const isDefault = current.bioMinLength === 0 && current.bioMaxLength === 500;
                    if (isDefault) {
                        await queryRunner.query('UPDATE social_profile_settings SET bio_min_length = ?, bio_max_length = ? WHERE id = 1', [
                            normalized.bioMinLength,
                            normalized.bioMaxLength
                        ]);
                    }
                }
            }
        }
        if (await queryRunner.hasTable('room_maintenance_settings')) {
            const legacy = safeParseJsonFile(roomPath);
            if (legacy) {
                const normalized = normalizeRoom(legacy);
                const rows = await queryRunner.query(`SELECT
            auto_cleanup_enabled as autoCleanupEnabled,
            auto_cleanup_older_than_minutes as autoCleanupOlderThanMinutes,
            auto_cleanup_interval_seconds as autoCleanupIntervalSeconds,
            auto_cleanup_limit as autoCleanupLimit
           FROM room_maintenance_settings
           WHERE id = 1
           LIMIT 1`);
                if (rows.length === 0) {
                    await queryRunner.query(`INSERT INTO room_maintenance_settings
              (id, auto_cleanup_enabled, auto_cleanup_older_than_minutes, auto_cleanup_interval_seconds, auto_cleanup_limit)
             VALUES (1, ?, ?, ?, ?)`, [
                        normalized.autoCleanupEnabled,
                        normalized.autoCleanupOlderThanMinutes,
                        normalized.autoCleanupIntervalSeconds,
                        normalized.autoCleanupLimit
                    ]);
                } else {
                    const current = rows[0];
                    const currentEnabled = current.autoCleanupEnabled === true || current.autoCleanupEnabled === 1;
                    const isDefault = currentEnabled === false && current.autoCleanupOlderThanMinutes === 60 && current.autoCleanupIntervalSeconds === 300 && current.autoCleanupLimit === 1000;
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
                            normalized.autoCleanupLimit
                        ]);
                    }
                }
            }
        }
    }
    async down(_queryRunner) {
    // No-op: importing legacy JSON is non-reversible.
    }
    constructor(){
        this.name = 'ImportLegacySettingsJson1735900000000';
    }
};
