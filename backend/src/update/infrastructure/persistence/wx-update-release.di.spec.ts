import { Test } from '@nestjs/testing';
import { WxUpdateArtifactValidatorService } from './wx-update-artifact-validator.service';
import { WxUpdateReleaseService } from './wx-update-release.service';

describe('WxUpdateReleaseService dependency injection', () => {
  it('resolves its validator through Nest metadata', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [WxUpdateArtifactValidatorService, WxUpdateReleaseService],
    }).compile();

    expect(moduleRef.get(WxUpdateReleaseService)).toBeInstanceOf(
      WxUpdateReleaseService,
    );
    await moduleRef.close();
  });
});
