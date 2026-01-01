import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SocialProfileSettingsService } from './social-profile-settings.service';

describe('SocialProfileSettingsService', () => {
  it('clamps min to max and caps max', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-profile-'));
    const svc = new SocialProfileSettingsService(tmp);
    const updated = svc.update({ bioMinLength: 9999, bioMaxLength: 6000 });
    expect(updated.bioMaxLength).toBe(5000);
    expect(updated.bioMinLength).toBe(5000);
  });

  it('persists settings to disk', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-profile-'));
    const svc = new SocialProfileSettingsService(tmp);
    svc.update({ bioMinLength: 10, bioMaxLength: 20 });
    const svc2 = new SocialProfileSettingsService(tmp);
    expect(svc2.get()).toEqual({ bioMinLength: 10, bioMaxLength: 20 });
  });
});

