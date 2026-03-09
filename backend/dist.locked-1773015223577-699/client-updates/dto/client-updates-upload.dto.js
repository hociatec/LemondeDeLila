"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get ClientUpdatesUploadChunkDto () {
        return ClientUpdatesUploadChunkDto;
    },
    get ClientUpdatesUploadCompleteDto () {
        return ClientUpdatesUploadCompleteDto;
    },
    get ClientUpdatesUploadInitDto () {
        return ClientUpdatesUploadInitDto;
    },
    get ClientUpdatesUploadMetaDto () {
        return ClientUpdatesUploadMetaDto;
    }
});
const _classtransformer = require("class-transformer");
const _classvalidator = require("class-validator");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let ClientUpdatesUploadMetaDto = class ClientUpdatesUploadMetaDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(100),
    _ts_metadata("design:type", String)
], ClientUpdatesUploadMetaDto.prototype, "version", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(2000),
    _ts_metadata("design:type", String)
], ClientUpdatesUploadMetaDto.prototype, "message", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(100),
    _ts_metadata("design:type", String)
], ClientUpdatesUploadMetaDto.prototype, "minRequiredVersion", void 0);
let ClientUpdatesUploadInitDto = class ClientUpdatesUploadInitDto extends ClientUpdatesUploadMetaDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classtransformer.Type)(()=>Number),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    _ts_metadata("design:type", Object)
], ClientUpdatesUploadInitDto.prototype, "totalBytes", void 0);
let ClientUpdatesUploadChunkDto = class ClientUpdatesUploadChunkDto {
};
_ts_decorate([
    (0, _classvalidator.IsUUID)(),
    _ts_metadata("design:type", String)
], ClientUpdatesUploadChunkDto.prototype, "uploadId", void 0);
_ts_decorate([
    (0, _classtransformer.Type)(()=>Number),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(0),
    _ts_metadata("design:type", Number)
], ClientUpdatesUploadChunkDto.prototype, "index", void 0);
let ClientUpdatesUploadCompleteDto = class ClientUpdatesUploadCompleteDto {
};
_ts_decorate([
    (0, _classvalidator.IsUUID)(),
    _ts_metadata("design:type", String)
], ClientUpdatesUploadCompleteDto.prototype, "uploadId", void 0);
