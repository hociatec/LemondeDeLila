"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadV1Content = loadV1Content;
function loadV1Content(contentLoader, params) {
    const validators = [contentLoader.validators.version(1)];
    if (params.arrayField) {
        if (typeof params.minItems === 'number') {
            validators.push(contentLoader.validators.arrayField(params.arrayField, params.minItems));
        }
        else {
            validators.push(contentLoader.validators.arrayField(params.arrayField));
        }
    }
    if (Array.isArray(params.extraValidators) && params.extraValidators.length) {
        validators.push(...params.extraValidators);
    }
    return contentLoader.loadContent({
        gameType: params.gameType,
        baseDir: params.baseDir,
        ...(params.contentDir ? { contentDir: params.contentDir } : {}),
        filename: params.filename,
        validators,
    });
}
//# sourceMappingURL=content-loader.helper.js.map