import { Test } from '@nestjs/testing';
import { CatPattesService } from '../cat-pattes.service';
import { GameRegistryService } from '../../../../engine/services/game-registry.service';
import { CatPattesSetupService } from '../setup/cat-pattes-setup.service';
import { CatPattesActionService } from '../actions/cat-pattes-action.service';
import { CatPattesPresenterService } from '../presenter/cat-pattes-presenter.service';
import { CatPattesBotService } from '../bots/cat-pattes-bot.service';

describe('CatPattesService', () => {
  it('should be defined', async () => {
    const module = await Test.createTestingModule({
      providers: [
        CatPattesService,
        { provide: GameRegistryService, useValue: { register: jest.fn() } },
        { provide: CatPattesSetupService, useValue: {} },
        { provide: CatPattesActionService, useValue: {} },
        { provide: CatPattesPresenterService, useValue: {} },
        { provide: CatPattesBotService, useValue: {} },
      ],
    }).compile();

    const service = module.get(CatPattesService);
    expect(service).toBeDefined();
  });
});
