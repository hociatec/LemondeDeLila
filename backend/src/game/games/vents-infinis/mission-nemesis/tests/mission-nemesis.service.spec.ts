import { Test } from '@nestjs/testing';
import { MissionNemesisModule } from '../mission-nemesis.module';
import { MissionNemesisService } from '../mission-nemesis.service';

describe('MissionNemesisService', () => {
  it('hydrates and exposes without actions', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MissionNemesisModule],
    }).compile();
    const service = moduleRef.get(MissionNemesisService);
    const state: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'A' }],
    } as any);
    const exposed: any = service.exposeState(state);
    expect(exposed.actions ?? []).toHaveLength(0);
  });
});
