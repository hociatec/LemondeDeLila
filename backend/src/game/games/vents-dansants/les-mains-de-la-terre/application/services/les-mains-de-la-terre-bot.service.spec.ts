import { LesMainsDeLaTerreBotService } from '../../application/services/les-mains-de-la-terre-bot.service';

describe('LesMainsDeLaTerreBotService', () => {
  it('doit Ãªtre dÃ©fini', () => {
    const runner = { choose: () => [] };
    const service = new LesMainsDeLaTerreBotService(runner as any);
    expect(service).toBeDefined();
  });
});


