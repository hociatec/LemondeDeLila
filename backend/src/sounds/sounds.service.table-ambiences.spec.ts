import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SoundsService } from './sounds.service';

describe('SoundsService table ambiences', () => {
  const originalEnv = {
    LMDL_SOUNDS_DIR: process.env.LMDL_SOUNDS_DIR,
    NODE_ENV: process.env.NODE_ENV,
  };
  let tempRoot = '';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lmdl-sounds-test-'));
    process.env.LMDL_SOUNDS_DIR = tempRoot;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.LMDL_SOUNDS_DIR = originalEnv.LMDL_SOUNDS_DIR;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function createService() {
    const notifications = {
      notifyAll: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new SoundsService(notifications);
    return { service, notifications };
  }

  it('defaults legacy entries to enabled=true and filters disabled in public list', async () => {
    const tableAmbiencesPath = path.join(tempRoot, 'table-ambiences.json');
    fs.writeFileSync(
      tableAmbiencesPath,
      JSON.stringify({
        updatedAt: '2026-03-01T00:00:00.000Z',
        items: [
          { soundId: 'TableAmbience1', name: 'Ambiance legacy sans flag' },
          { soundId: 'TableAmbience2', name: 'Ambiance inactive', enabled: false },
        ],
      }),
      'utf-8',
    );

    const { service } = createService();

    const all = await service.listTableAmbiencesWithFilter({
      includeDisabled: true,
    });
    expect(all.items).toEqual([
      {
        soundId: 'TableAmbience1',
        name: 'Ambiance legacy sans flag',
        enabled: true,
      },
      {
        soundId: 'TableAmbience2',
        name: 'Ambiance inactive',
        enabled: false,
      },
    ]);

    const publicList = await service.listTableAmbiencesWithFilter();
    expect(publicList.items).toEqual([
      {
        soundId: 'TableAmbience1',
        name: 'Ambiance legacy sans flag',
        enabled: true,
      },
    ]);
  });

  it('keeps enabled flag when renaming and allows enable/disable toggles', async () => {
    const { service, notifications } = createService();
    await service.createTableAmbience('Ambiance 1');

    const disabled = await service.setTableAmbienceEnabled(
      'TableAmbience1',
      false,
    );
    expect(disabled.enabled).toBe(false);

    const renamed = await service.renameTableAmbience(
      'TableAmbience1',
      'Ambiance 1 renommee',
    );
    expect(renamed.enabled).toBe(false);

    const hiddenFromPublic = await service.listTableAmbiencesWithFilter();
    expect(hiddenFromPublic.items).toHaveLength(0);

    const reenabled = await service.setTableAmbienceEnabled(
      'TableAmbience1',
      true,
    );
    expect(reenabled.enabled).toBe(true);

    const visibleInPublic = await service.listTableAmbiencesWithFilter();
    expect(visibleInPublic.items).toEqual([
      {
        soundId: 'TableAmbience1',
        name: 'Ambiance 1 renommee',
        enabled: true,
      },
    ]);

    expect(notifications.notifyAll).toHaveBeenCalled();
  });

  it('enforces max 20 table ambiences', async () => {
    const { service } = createService();

    for (let i = 1; i <= 20; i++) {
      await service.createTableAmbience(`Ambiance ${i}`);
    }

    await expect(
      service.createTableAmbience('Ambiance overflow'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

