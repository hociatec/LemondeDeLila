import { NawakBotService } from '../../application/services/nawak-bot.service';

describe('NawakBotService', () => {
  it('should be defined', () => {
    const runner = { choose: () => [] };
    const service = new NawakBotService(runner as any);
    expect(service).toBeDefined();
  });
});


