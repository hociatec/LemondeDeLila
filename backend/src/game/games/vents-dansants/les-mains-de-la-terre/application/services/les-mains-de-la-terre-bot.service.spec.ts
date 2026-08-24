import { LesMainsDeLaTerreBotService } from '../../application/services/les-mains-de-la-terre-bot.service';

describe('LesMainsDeLaTerreBotService', () => {
  it('doit être défini', () => {
    const runner = { choose: () => [] };
    const service = new LesMainsDeLaTerreBotService(runner as any);
    expect(service).toBeDefined();
  });
});


