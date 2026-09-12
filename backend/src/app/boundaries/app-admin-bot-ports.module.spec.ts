import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ADMIN_BOT_PORT,
  type AdminBotPort,
} from '../../modules/admin/public-api';
import {
  CreateBotNameService,
  DeleteBotNameService,
  ListBotNamesService,
  UpdateBotNameService,
} from '../../modules/bot/public-api';
import { BotModule } from '../../modules/bot/composition-api';
import { BotSettingsService } from '../../game/public-api';
import { BotModule as GameBotModule } from '../../game/composition-api';
import { AppAdminBotPortsModule } from './app-admin-bot-ports.module';

const names = {
  list: jest.fn().mockResolvedValue([]),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};
const settings = {
  getSettings: jest.fn().mockReturnValue({}),
  updateSettings: jest.fn().mockResolvedValue({}),
};

@Module({
  providers: [
    { provide: ListBotNamesService, useValue: { execute: names.list } },
    { provide: CreateBotNameService, useValue: { execute: names.create } },
    { provide: UpdateBotNameService, useValue: { execute: names.update } },
    { provide: DeleteBotNameService, useValue: { execute: names.remove } },
  ],
  exports: [
    ListBotNamesService,
    CreateBotNameService,
    UpdateBotNameService,
    DeleteBotNameService,
  ],
})
class BotFixtureModule {}

@Module({
  providers: [{ provide: BotSettingsService, useValue: settings }],
  exports: [BotSettingsService],
})
class GameBotFixtureModule {}

it('binds admin bot operations and game bot settings', async () => {
  const app = await Test.createTestingModule({
    imports: [AppAdminBotPortsModule],
  })
    .overrideModule(BotModule)
    .useModule(BotFixtureModule)
    .overrideModule(GameBotModule)
    .useModule(GameBotFixtureModule)
    .compile();
  try {
    const port = app.get<AdminBotPort>(ADMIN_BOT_PORT);
    await expect(port.listNames()).resolves.toEqual([]);
    expect(port.getSettings()).toEqual({});
  } finally {
    await app.close();
  }
});
