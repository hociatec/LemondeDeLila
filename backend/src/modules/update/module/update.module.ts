import { Module } from '@nestjs/common';

import { UpdatePolicyService } from '../application/update-policy.service';
import { WX_UPDATE_RELEASE_READER } from '../application/wx-update-release.reader';
import { CiWxUpdateController } from '../infrastructure/http/ci-wx-update.controller';
import { UpdateStaticService } from '../infrastructure/http/update-static.service';
import { UpdateUploadTokenGuard } from '../infrastructure/http/update-upload-token.guard';
import { WxUpdateManifestController } from '../infrastructure/http/wx-update-manifest.controller';
import { WxUpdateLatestController } from '../infrastructure/http/wx-update-latest.controller';
import { WxUpdateReleaseService } from '../infrastructure/persistence/wx-update-release.service';
import { WxUpdateArtifactValidatorService } from '../infrastructure/persistence/wx-update-artifact-validator.service';
import { WxUpdateUploadService } from '../infrastructure/persistence/wx-update-upload.service';

@Module({
  controllers: [
    WxUpdateManifestController,
    WxUpdateLatestController,
    CiWxUpdateController,
  ],
  providers: [
    WxUpdateArtifactValidatorService,
    WxUpdateReleaseService,
    {
      provide: WX_UPDATE_RELEASE_READER,
      useExisting: WxUpdateReleaseService,
    },
    WxUpdateUploadService,
    UpdatePolicyService,
    UpdateStaticService,
    UpdateUploadTokenGuard,
  ],
  exports: [WxUpdateReleaseService, UpdatePolicyService],
})
export class UpdateModule {}
