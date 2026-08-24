import { Module } from '@nestjs/common';

import { ClientUpdatesModule } from '../../client-updates/public-api';
import { UpdatePolicyService } from '../application/update-policy.service';
import { WX_UPDATE_RELEASE_READER } from '../application/wx-update-release.reader';
import { CiWxUpdateController } from '../infrastructure/http/ci-wx-update.controller';
import { UpdateStaticService } from '../infrastructure/http/update-static.service';
import { UpdateUploadTokenGuard } from '../infrastructure/http/update-upload-token.guard';
import { WxUpdateManifestController } from '../infrastructure/http/wx-update-manifest.controller';
import { WxUpdateLatestController } from '../infrastructure/http/wx-update-latest.controller';
import { WxUpdateReleaseService } from '../infrastructure/persistence/wx-update-release.service';
import { WxUpdateUploadService } from '../infrastructure/persistence/wx-update-upload.service';

@Module({
  imports: [ClientUpdatesModule],
  controllers: [
    WxUpdateManifestController,
    WxUpdateLatestController,
    CiWxUpdateController,
  ],
  providers: [
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
  exports: [ClientUpdatesModule, WxUpdateReleaseService, UpdatePolicyService],
})
export class UpdateModule {}
