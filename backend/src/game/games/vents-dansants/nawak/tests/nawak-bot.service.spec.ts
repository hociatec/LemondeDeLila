import { NawakBotService } from '../bots/nawak-bot.service';

describe('NawakBotService', () => {
  it('should be defined', () => {
    const runner = { choose: () => [] };
    const service = new NawakBotService(runner as any);
    expect(service).toBeDefined();
  });
});
