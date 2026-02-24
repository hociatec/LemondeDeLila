"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVersion = parseVersion;
exports.isVersionGreater = isVersionGreater;
exports.isVersionLower = isVersionLower;
function parseVersion(value) {
    const raw = (value ?? '').trim();
    if (!raw)
        return null;
    const parts = raw
        .split('.')
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < 1 || parts.length > 4)
        return null;
    const nums = [];
    for (const p of parts) {
        if (!/^\d+$/.test(p))
            return null;
        nums.push(Number(p));
    }
    while (nums.length < 4)
        nums.push(0);
    return (nums[0] * 1_000_000_000 + nums[1] * 1_000_000 + nums[2] * 1_000 + nums[3]);
}
function isVersionGreater(a, b) {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (pa == null || pb == null)
        return null;
    return pa > pb;
}
function isVersionLower(a, b) {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (pa == null || pb == null)
        return null;
    return pa < pb;
}
//# sourceMappingURL=version.utils.js.map